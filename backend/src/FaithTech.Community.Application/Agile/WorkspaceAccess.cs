using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

/// <summary>How the caller relates to one workspace (ADR 0011), from least to most access.</summary>
public enum WorkspaceAccess
{
    Outsider,
    Staff,
    /// <summary>A System Admin who does not own the workspace, member or not: every write is an audited override.</summary>
    Admin,
    Member,
    Owner,
}

public record WorkspaceCaller(Guid ProfileId, WorkspaceAccess Access)
{
    public bool CanRead => Access != WorkspaceAccess.Outsider;

    /// <summary>Stories, tasks, comments, card moves, sprint planning and Planning Poker.</summary>
    public bool CanEdit => Access is WorkspaceAccess.Member or WorkspaceAccess.Owner or WorkspaceAccess.Admin;

    /// <summary>Initiatives and epics, settings, members, sprints, method and archive.</summary>
    public bool CanManage => Access is WorkspaceAccess.Owner or WorkspaceAccess.Admin;

    public bool IsOverride => Access == WorkspaceAccess.Admin;

    /// <summary>404 for an outsider, 403 for a reader without the right, otherwise null.</summary>
    public Result? Refuse(bool manage) =>
        !CanRead ? Result.NotFound()
            : (manage ? CanManage : CanEdit) ? null
            : Result.Forbidden();
}

/// <summary>
/// Decides who may read and change a workspace and everything in it (L2-031, L2-042, ADR 0011).
/// Every agile handler and the hub ask it first; lists use <see cref="Visible"/> so the filter runs in the database.
/// </summary>
public class WorkspaceAccessPolicy(IApplicationDbContext db, ICurrentUser current, ProfileAccess profiles, IAuditLog audit)
{
    public bool ReadsEverything => current.HasRole(Role.Staff) || current.HasRole(Role.SystemAdmin);

    public bool IsSystemAdmin => current.HasRole(Role.SystemAdmin);

    public Task<Guid?> CallerProfileIdAsync(CancellationToken cancellationToken = default) => profiles.CallerProfileIdAsync(cancellationToken);

    /// <summary>
    /// Owner first; then System Admin, even when they also belong to the workspace, so every action a System Admin
    /// takes outside their own workspace succeeds and is audited (L2-031 AC7); then member, Staff and outsider.
    /// </summary>
    public WorkspaceAccess Classify(Workspace workspace, Guid? caller) =>
        caller is { } me && workspace.OwnerId == me ? WorkspaceAccess.Owner
            : current.HasRole(Role.SystemAdmin) ? WorkspaceAccess.Admin
            : caller is { } m && workspace.Members.Any(x => x.ProfileId == m) ? WorkspaceAccess.Member
            : current.HasRole(Role.Staff) ? WorkspaceAccess.Staff
            : WorkspaceAccess.Outsider;

    /// <summary>The workspaces the caller may read.</summary>
    public IQueryable<Workspace> Visible(IQueryable<Workspace> workspaces, Guid? caller) =>
        ReadsEverything ? workspaces
            : caller is { } me ? workspaces.Where(w => w.OwnerId == me || w.Members.Any(m => m.ProfileId == me))
            : workspaces.Where(_ => false);

    /// <summary>
    /// Loads a workspace (tracked) with the caller's access. The workspace is null when it does not exist or, unless
    /// <paramref name="includeArchived"/>, when it is archived.
    /// </summary>
    public async Task<(Workspace? Workspace, WorkspaceCaller Caller)> LoadAsync(
        Guid workspaceId, CancellationToken cancellationToken = default, bool includeArchived = false)
    {
        var caller = await CallerProfileIdAsync(cancellationToken);
        var workspaces = includeArchived ? db.Workspaces.IgnoreQueryFilters(QueryFilters.ArchivedOnly) : db.Workspaces;
        var workspace = await workspaces.SingleOrDefaultAsync(w => w.Id == workspaceId, cancellationToken);
        return workspace is null
            ? (null, new WorkspaceCaller(caller ?? Guid.Empty, WorkspaceAccess.Outsider))
            : (workspace, new WorkspaceCaller(caller ?? Guid.Empty, Classify(workspace, caller)));
    }

    /// <summary>
    /// Loads a workspace for a write: the refusal is 404 when it is missing or the caller may not read it, 403 when
    /// they may read but lack the right (<paramref name="manage"/> for owner actions), otherwise null.
    /// </summary>
    public async Task<(Workspace Workspace, WorkspaceCaller Caller, Result? Refusal)> AuthorizeAsync(
        Guid workspaceId, bool manage, CancellationToken cancellationToken = default, bool includeArchived = false)
    {
        var (workspace, caller) = await LoadAsync(workspaceId, cancellationToken, includeArchived);
        return workspace is null ? (null!, caller, Result.NotFound()) : (workspace, caller, caller.Refuse(manage));
    }

    /// <summary>Records an action only a System Admin may take, such as reassigning the owner.</summary>
    public void Audit(WorkspaceCaller caller, string action, string targetType, Guid targetId, object? before, object? after) =>
        audit.Record(caller.ProfileId, action, targetType, targetId.ToString(), before, after);

    /// <summary>Records a System Admin override (ADR 0011); writes by the owner or a member are not audited.</summary>
    public void AuditOverride(WorkspaceCaller caller, string action, string targetType, Guid targetId, object? before, object? after)
    {
        if (caller.IsOverride)
        {
            audit.Record(caller.ProfileId, action, targetType, targetId.ToString(), before, after);
        }
    }
}
