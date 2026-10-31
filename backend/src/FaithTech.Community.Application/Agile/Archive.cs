using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

/// <summary>An archived item on the settings page, ready to restore (L2-037 AC1).</summary>
public record ArchivedItemDto(Guid Id, string Kind, string Title, DateTimeOffset ArchivedAt, string ArchivedByName);

public record ReassignOwnerCommand(Guid? OwnerId);

public class ReassignOwnerValidator : AbstractValidator<ReassignOwnerCommand>
{
    public ReassignOwnerValidator()
    {
        RuleFor(x => x.OwnerId).NotNull().WithMessage("Choose who will own this workspace.");
    }
}

/// <summary>
/// Archives and restores workspaces and work items, and reassigns ownership (L2-037). Archive is an owner action;
/// System Admin may do it too and is audited (ADR 0011). An archived workspace stays hidden from everyone else.
/// </summary>
public class ArchiveHandler(IApplicationDbContext db, WorkspaceAccessPolicy policy, TimeProvider time)
{
    public const string NotCityLeadMessage = "Choose a City Lead.";

    public Task<Result> ArchiveWorkspaceAsync(Guid workspaceId, CancellationToken cancellationToken = default) =>
        SetWorkspaceArchivedAsync(workspaceId, archive: true, cancellationToken);

    public Task<Result> RestoreWorkspaceAsync(Guid workspaceId, CancellationToken cancellationToken = default) =>
        SetWorkspaceArchivedAsync(workspaceId, archive: false, cancellationToken);

    public Task<Result> ArchiveItemAsync(Guid itemId, CancellationToken cancellationToken = default) =>
        SetItemArchivedAsync(itemId, archive: true, cancellationToken);

    public Task<Result> RestoreItemAsync(Guid itemId, CancellationToken cancellationToken = default) =>
        SetItemArchivedAsync(itemId, archive: false, cancellationToken);

    /// <summary>Archived items whose parent is not archived, newest first: restoring one brings back what was archived with it.</summary>
    public async Task<(Result Result, IReadOnlyList<ArchivedItemDto>? Items)> ArchivedItemsAsync(Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var (_, _, refusal) = await policy.AuthorizeAsync(workspaceId, manage: true, cancellationToken);
        if (refusal is not null)
        {
            return (refusal, null);
        }

        var archived = await db.WorkItems.IgnoreQueryFilters(QueryFilters.ArchivedOnly).AsNoTracking()
            .Where(i => i.WorkspaceId == workspaceId && i.IsArchived)
            .ToListAsync(cancellationToken);
        var archivedIds = archived.Select(i => i.Id).ToHashSet();
        var roots = archived.Where(i => i.ParentId is not { } p || !archivedIds.Contains(p)).ToList();
        var byIds = roots.Select(i => i.ArchivedById).OfType<Guid>().Distinct().ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => byIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        return (Result.Ok(), [.. roots
            .OrderByDescending(i => i.ArchivedAt)
            .ThenBy(i => i.Title)
            .Select(i => new ArchivedItemDto(
                i.Id,
                i.Kind.ToString(),
                i.Title,
                i.ArchivedAt ?? DateTimeOffset.MinValue,
                i.ArchivedById is { } by ? names.GetValueOrDefault(by) ?? "A former member" : "A former member"))]);
    }

    /// <summary>City Leads who could take the workspace over, for System Admin only.</summary>
    public async Task<(Result Result, IReadOnlyList<MemberCandidateDto>? Candidates)> OwnerCandidatesAsync(Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var (workspace, _, refusal) = await AuthorizeAdminAsync(workspaceId, cancellationToken);
        if (refusal is not null)
        {
            return (refusal, null);
        }

        var leads = await db.Profiles.AsNoTracking()
            .Where(p => !p.IsSuspended && p.Id != workspace.OwnerId && p.Roles.Any(r => r.Role == Role.CityLead))
            .OrderBy(p => p.Name)
            .ToListAsync(cancellationToken);
        return (Result.Ok(), [.. leads.Select(p => new MemberCandidateDto(p.Id, p.Name, [.. p.Roles.Select(r => r.Role).Order().Select(r => r.ToString())]))]);
    }

    /// <summary>System Admin gives the workspace to another City Lead; always audited (L2-037 AC2, L2-041).</summary>
    public async Task<Result> ReassignOwnerAsync(Guid workspaceId, ReassignOwnerCommand command, CancellationToken cancellationToken = default)
    {
        var (workspace, caller, refusal) = await AuthorizeAdminAsync(workspaceId, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        var owner = await db.Profiles.SingleOrDefaultAsync(p => p.Id == command.OwnerId, cancellationToken);
        if (owner is null || owner.IsSuspended || !owner.HasRole(Role.CityLead))
        {
            return Result.Invalid("OwnerId", NotCityLeadMessage);
        }

        var before = workspace.OwnerId;
        workspace.ReassignOwner(owner, time.GetUtcNow());
        policy.Audit(caller, "workspace.owner.reassigned", "Workspace", workspace.Id, new { OwnerId = before }, new { workspace.OwnerId });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private async Task<(Workspace Workspace, WorkspaceCaller Caller, Result? Refusal)> AuthorizeAdminAsync(Guid workspaceId, CancellationToken cancellationToken)
    {
        var (workspace, caller) = await policy.LoadAsync(workspaceId, cancellationToken);
        return workspace is null || !caller.CanRead ? (null!, caller, Result.NotFound())
            : !policy.IsSystemAdmin ? (null!, caller, Result.Forbidden())
            : (workspace, caller, null);
    }

    private async Task<Result> SetWorkspaceArchivedAsync(Guid workspaceId, bool archive, CancellationToken cancellationToken)
    {
        var (workspace, caller, refusal) = await policy.AuthorizeAsync(workspaceId, manage: true, cancellationToken, includeArchived: true);
        if (refusal is not null)
        {
            // Only the owner and System Admin know an archived workspace exists.
            return workspace is { IsArchived: true } ? Result.NotFound() : refusal;
        }

        if (workspace.IsArchived == archive)
        {
            return Result.Conflict(archive ? "This workspace is already archived." : "This workspace isn’t archived.");
        }

        if (archive)
        {
            workspace.Archive();
        }
        else
        {
            workspace.Restore();
        }

        policy.AuditOverride(caller, archive ? "workspace.archived" : "workspace.restored", "Workspace", workspace.Id, new { IsArchived = !archive }, new { workspace.IsArchived });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private async Task<Result> SetItemArchivedAsync(Guid itemId, bool archive, CancellationToken cancellationToken)
    {
        var items = db.WorkItems.IgnoreQueryFilters(QueryFilters.ArchivedOnly);
        var item = await items.SingleOrDefaultAsync(i => i.Id == itemId, cancellationToken);
        if (item is null)
        {
            return Result.NotFound();
        }

        var (_, caller, refusal) = await policy.AuthorizeAsync(item.WorkspaceId, manage: true, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        if (item.IsArchived == archive)
        {
            return Result.Conflict(archive ? "This item is already archived." : "This item isn’t archived.");
        }

        var workspaceItems = await items.Where(i => i.WorkspaceId == item.WorkspaceId).ToListAsync(cancellationToken);
        if (archive)
        {
            item.Archive(workspaceItems, caller.ProfileId, time.GetUtcNow());
        }
        else
        {
            item.Restore(workspaceItems);
        }

        policy.AuditOverride(caller, archive ? "workitem.archived" : "workitem.restored", "WorkItem", item.Id, new { IsArchived = !archive }, new { item.IsArchived });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}

/// <summary>
/// When an owner loses the City Lead role, tells every System Admin which of their workspaces needs a new owner
/// (L2-037 AC2). The actor is a System Admin too and is told as well: they are the one who can reassign it.
/// </summary>
public class CityLeadRoleRemovedHandler(IApplicationDbContext db, AgileNotifier notifier)
{
    public async Task HandleAsync(CityLeadRoleRemoved removed, CancellationToken cancellationToken = default)
    {
        var workspaces = await db.Workspaces.AsNoTracking().Where(w => w.OwnerId == removed.ProfileId).ToListAsync(cancellationToken);
        if (workspaces.Count == 0)
        {
            return;
        }

        var name = await db.Profiles.Where(p => p.Id == removed.ProfileId).Select(p => p.Name).SingleAsync(cancellationToken);
        var admins = await db.Profiles.AsNoTracking()
            .Where(p => !p.IsSuspended && p.Roles.Any(r => r.Role == Role.SystemAdmin))
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);
        foreach (var workspace in workspaces)
        {
            var title = $"{name} no longer holds the City Lead role but owns {workspace.Name}";
            foreach (var admin in admins)
            {
                notifier.Notify(
                    Guid.Empty,
                    admin,
                    NotificationKind.WorkspaceOwnerLostCityLead,
                    title,
                    $"/workspaces/{workspace.Id}/settings",
                    $"{workspace.Name} needs a new owner",
                    $"{title}. A workspace owner must be a City Lead, so choose a new owner.\n\nOpen the workspace settings:");
            }
        }
    }

    public Task QueueEmailsAsync(CancellationToken cancellationToken = default) => notifier.QueueEmailsAsync(cancellationToken);
}
