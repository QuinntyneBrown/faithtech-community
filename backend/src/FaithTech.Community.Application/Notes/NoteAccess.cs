using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notes;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

/// <summary>
/// Who may open and change note pages (L2-092, L2-098, ADR 0025). Visibility is applied inside every query against
/// the caller's roles at request time; a page the caller may not open is not found. Only the owner changes a page,
/// or a System Admin, whose change is audited.
/// </summary>
public class NoteAccess(IApplicationDbContext db, ICurrentUser current)
{
    /// <summary>The roles a page can be shared with, as for resources (L2-093).</summary>
    public static readonly IReadOnlyList<Role> ShareableRoles =
        [Role.CityLead, Role.EventLead, Role.CreateLead, Role.CommunicationsLead, Role.Volunteer, Role.ProductEngineer, Role.Staff];

    private Guid? _caller;

    public bool IsSystemAdmin => current.HasRole(Role.SystemAdmin);

    /// <summary>The caller's roles now, for matching role audiences inside a query.</summary>
    public List<Role> Roles => [.. current.Roles];

    /// <summary>The caller's profile id, or <see cref="Guid.Empty"/> when there is none.</summary>
    public async Task<Guid> CallerAsync(CancellationToken cancellationToken = default) =>
        _caller ??= await Task.FromResult(current.ProfileId ?? Guid.Empty);

    /// <summary>The active pages the caller may open: Global, their own, or Shared with them or a role they hold now.</summary>
    public IQueryable<NotePage> Visible(IQueryable<NotePage> pages, Guid caller)
    {
        var active = pages.Where(p => p.ArchivedAt == null);
        if (IsSystemAdmin)
        {
            return active;
        }

        var roles = current.Roles.ToList();
        return active.Where(p =>
            p.Visibility == NoteVisibility.Global
            || p.OwnerId == caller
            || (p.Visibility == NoteVisibility.Shared
                && (p.SharedMembers.Any(m => m.ProfileId == caller) || p.SharedRoles.Any(x => roles.Contains(x.Role)))));
    }

    /// <summary>One page the caller may open; archived ones only for their owner and System Admin (L2-095).</summary>
    public async Task<NotePage?> FindAsync(Guid id, Guid caller, CancellationToken cancellationToken = default)
    {
        var visible = await Visible(db.NotePages, caller).SingleOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (visible is not null)
        {
            return visible;
        }

        var archived = await db.NotePages.SingleOrDefaultAsync(p => p.Id == id && p.ArchivedAt != null, cancellationToken);
        return archived is not null && (archived.OwnerId == caller || IsSystemAdmin) ? archived : null;
    }

    public bool CanChange(NotePage page, Guid caller) => page.OwnerId == caller || IsSystemAdmin;

    /// <summary>A System Admin acting on a page they do not own: written to the audit log (L2-098).</summary>
    public bool IsOverride(NotePage page, Guid caller) => page.OwnerId != caller && IsSystemAdmin;

    /// <summary>Refuses a caller whose email is not verified (L2-085, as L2-002 AC3).</summary>
    public async Task<Result?> VerifiedAsync(Guid caller, CancellationToken cancellationToken)
    {
        var verified = await db.Users.Where(u => db.Profiles.Any(p => p.Id == caller && p.UserId == u.Id)).Select(u => u.EmailConfirmed).SingleOrDefaultAsync(cancellationToken);
        return verified ? null : Result.Forbidden("Verify your email before creating pages.");
    }
}
