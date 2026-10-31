using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Team;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

public record CreateWorkspaceCommand(string? Name, string? Method, IReadOnlyList<Guid>? MemberIds = null);

public class CreateWorkspaceValidator : AbstractValidator<CreateWorkspaceCommand>
{
    public const int MaxName = 100;

    public CreateWorkspaceValidator()
    {
        RuleFor(x => x.Name).Cascade(CascadeMode.Stop)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("Give the workspace a name.")
            .Must(name => name!.Trim().Length <= MaxName).WithMessage($"Use {MaxName} characters or fewer for the name.");
        RuleFor(x => x.Method)
            .Must(method => Enum.TryParse<WorkspaceMethod>(method, ignoreCase: false, out var m) && Enum.IsDefined(m))
            .WithMessage("Choose Scrum or Kanban.");
    }
}

/// <summary>Creates, lists and reads workspaces (L2-031, L2-050).</summary>
public class WorkspacesHandler(
    IApplicationDbContext db,
    ICurrentUser current,
    WorkspaceAccessPolicy policy,
    WorkspaceMembership membership,
    AgileNotifier notifier)
{
    public const string NotOnTeamMessage = "Only people with a lead or volunteer role can be added.";

    /// <summary>A City Lead (or System Admin) creates a workspace and owns it; a City Lead may own several.</summary>
    public async Task<(Result Result, WorkspaceDto? Workspace)> CreateAsync(CreateWorkspaceCommand command, CancellationToken cancellationToken = default)
    {
        if (!current.HasRole(Role.CityLead) && !current.HasRole(Role.SystemAdmin))
        {
            return (Result.Forbidden(), null);
        }

        var caller = await policy.CallerProfileIdAsync(cancellationToken);
        if (caller is not { } owner)
        {
            return (Result.Forbidden(), null);
        }

        var workspace = new Workspace(command.Name!.Trim(), Enum.Parse<WorkspaceMethod>(command.Method!), owner);
        var added = await membership.AddMembersAsync(workspace, owner, command.MemberIds ?? [], cancellationToken);
        if (added is null)
        {
            return (Result.Invalid("MemberIds", NotOnTeamMessage), null);
        }

        db.Workspaces.Add(workspace);
        await notifier.QueueEmailsAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await GetAsync(workspace.Id, cancellationToken));
    }

    /// <summary>
    /// Members see the workspaces they own or belong to; Staff and System Admin see every one (L2-050). Archived
    /// workspaces are listed only to their owner and System Admin, so they can be restored (ADR 0011).
    /// </summary>
    public async Task<IReadOnlyList<WorkspaceSummaryDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var caller = await policy.CallerProfileIdAsync(cancellationToken);
        var admin = policy.IsSystemAdmin;
        var live = await policy.Visible(db.Workspaces.AsNoTracking(), caller).ToListAsync(cancellationToken);
        var archived = await db.Workspaces.IgnoreQueryFilters(QueryFilters.ArchivedOnly).AsNoTracking()
            .Where(w => w.IsArchived && (admin || w.OwnerId == caller))
            .ToListAsync(cancellationToken);
        var workspaces = live.Concat(archived).OrderBy(w => w.Name).ToList();

        var ids = workspaces.Select(w => w.Id).ToList();
        var ownerIds = workspaces.Select(w => w.OwnerId).Distinct().ToList();
        var owners = await db.Profiles.AsNoTracking().Where(p => ownerIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, cancellationToken);
        var sprints = await db.Sprints.AsNoTracking()
            .Where(s => ids.Contains(s.WorkspaceId) && s.State == SprintState.Active)
            .ToDictionaryAsync(s => s.WorkspaceId, s => s.Name, cancellationToken);

        return [.. workspaces.Select(w => new WorkspaceSummaryDto(
            w.Id,
            w.Name,
            w.Method.ToString(),
            w.OwnerId,
            owners.GetValueOrDefault(w.OwnerId)?.Name ?? "A former member",
            w.OwnerId == caller,
            sprints.GetValueOrDefault(w.Id),
            w.Members.Select(m => m.ProfileId).Append(w.OwnerId).Distinct().Count(),
            w.IsArchived,
            !w.IsArchived && NeedsNewOwner(owners.GetValueOrDefault(w.OwnerId))))];
    }

    /// <summary>The workspace with its members, or null when the caller may not see it (404, L2-042 AC2).</summary>
    public async Task<WorkspaceDto?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var (workspace, caller) = await policy.LoadAsync(id, cancellationToken);
        if (workspace is null || !caller.CanRead)
        {
            return null;
        }

        var memberIds = workspace.Members.Select(m => m.ProfileId).Append(workspace.OwnerId).Distinct().ToList();
        var profiles = await db.Profiles.AsNoTracking().Where(p => memberIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, cancellationToken);
        var assigned = await db.WorkItems.AsNoTracking()
            .Where(i => i.WorkspaceId == id && i.AssigneeId != null)
            .GroupBy(i => new { i.AssigneeId, IsTask = i.Kind == WorkItemKind.Task })
            .Select(g => new { g.Key.AssigneeId, g.Key.IsTask, Count = g.Count() })
            .ToListAsync(cancellationToken);
        int Count(Guid profileId, bool tasks) => assigned.Where(a => a.AssigneeId == profileId && a.IsTask == tasks).Sum(a => a.Count);

        var members = memberIds
            .Select(pid => new WorkspaceMemberDto(
                pid,
                profiles.GetValueOrDefault(pid)?.Name ?? "A former member",
                profiles.GetValueOrDefault(pid) is { } p ? [.. p.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key)] : [],
                pid == workspace.OwnerId,
                Count(pid, tasks: false),
                Count(pid, tasks: true),
                pid == caller.ProfileId))
            .OrderByDescending(m => m.IsOwner)
            .ThenBy(m => m.Name)
            .ToList();
        var owner = profiles.GetValueOrDefault(workspace.OwnerId);
        return new WorkspaceDto(
            workspace.Id,
            workspace.Name,
            workspace.Method.ToString(),
            workspace.OwnerId,
            owner?.Name ?? "A former member",
            members,
            workspace.IsArchived,
            caller.Access.ToString(),
            caller.CanEdit,
            caller.CanManage,
            NeedsNewOwner(owner));
    }

    /// <summary>
    /// An owner must hold City Lead (or be a System Admin); otherwise System Admin reassigns it (L2-037 AC2). An archived
    /// workspace is not flagged: nobody can act on it until it is restored, and then it is (ADR 0011).
    /// </summary>
    private static bool NeedsNewOwner(Profile? owner) =>
        owner is null || (!owner.HasRole(Role.CityLead) && !owner.HasRole(Role.SystemAdmin));
}

/// <summary>Adds members to a workspace and notifies each of them (L2-031 AC2).</summary>
public class WorkspaceMembership(IApplicationDbContext db, AgileNotifier notifier, TimeProvider time)
{
    /// <summary>Adds the profiles and queues their notifications; null (nothing added) when one is not on the team or is suspended.</summary>
    public async Task<IReadOnlyList<Guid>?> AddMembersAsync(Workspace workspace, Guid actor, IReadOnlyList<Guid> profileIds, CancellationToken cancellationToken)
    {
        var ids = profileIds.Distinct().Where(id => !workspace.IsMember(id)).ToList();
        var profiles = await db.Profiles.Where(p => ids.Contains(p.Id)).ToListAsync(cancellationToken);
        if (profiles.Count != ids.Count || !profiles.All(p => TeamRoles.IsTeamMember(p) && !p.IsSuspended))
        {
            return null;
        }

        var actorName = await db.Profiles.Where(p => p.Id == actor).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken) ?? "A City Lead";
        var now = time.GetUtcNow();
        foreach (var profile in profiles)
        {
            workspace.AddMember(profile, now);
            notifier.Notify(
                actor,
                profile.Id,
                NotificationKind.WorkspaceMemberAdded,
                $"{actorName} added you to the workspace {workspace.Name}",
                $"/workspaces/{workspace.Id}",
                $"You’ve been added to {workspace.Name}",
                $"{actorName} added you to the {workspace.Name} workspace. You can add stories and tasks, move cards, comment and vote in Planning Poker.\n\nOpen the workspace:");
        }

        return [.. profiles.Select(p => p.Id)];
    }
}
