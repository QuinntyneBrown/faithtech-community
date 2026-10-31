using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

/// <summary>
/// Who may add, open and change resources (L2-057, L2-060, L2-062, L2-066). Visibility is applied inside every
/// query, against the caller's roles at request time (ADR 0017); a resource the caller may not open is not found.
/// </summary>
public class ResourceAccess(IApplicationDbContext db, ICurrentUser current)
{
    /// <summary>The roles that may add and own resources. Staff is the deliberate carve-out from read-only (ADR 0017).</summary>
    public static readonly IReadOnlyList<Role> ContributorRoles =
        [Role.CityLead, Role.EventLead, Role.CreateLead, Role.CommunicationsLead, Role.Staff, Role.SystemAdmin];

    /// <summary>The roles a resource can be shared with (L2-061 AC1).</summary>
    public static readonly IReadOnlyList<Role> ShareableRoles =
        [Role.CityLead, Role.EventLead, Role.CreateLead, Role.CommunicationsLead, Role.Volunteer, Role.ProductEngineer, Role.Staff];

    private Guid? _caller;

    public bool CanContribute => ContributorRoles.Any(current.HasRole);

    public bool IsSystemAdmin => current.HasRole(Role.SystemAdmin);

    /// <summary>The caller's roles now, for matching role audiences inside a query.</summary>
    public List<Role> Roles => [.. current.Roles];

    /// <summary>The caller's profile id, or <see cref="Guid.Empty"/> when there is none.</summary>
    public async Task<Guid> CallerAsync(CancellationToken cancellationToken = default) =>
        _caller ??= await Task.FromResult(current.ProfileId ?? Guid.Empty);

    /// <summary>The active resources the caller may open: Global, their own, or Shared with them or a role they hold now.</summary>
    public IQueryable<Resource> Visible(IQueryable<Resource> resources, Guid caller)
    {
        var active = resources.Where(r => r.ArchivedAt == null);
        if (IsSystemAdmin)
        {
            return active;
        }

        var roles = current.Roles.ToList();
        return active.Where(r =>
            r.Visibility == ResourceVisibility.Global
            || r.OwnerId == caller
            || (r.Visibility == ResourceVisibility.Shared
                && (r.SharedMembers.Any(m => m.ProfileId == caller) || r.SharedRoles.Any(x => roles.Contains(x.Role)))));
    }

    /// <summary>One resource the caller may open; archived ones only for their owner and System Admin (L2-063 AC2).</summary>
    public async Task<Resource?> FindAsync(Guid id, Guid caller, CancellationToken cancellationToken = default)
    {
        var visible = await Visible(db.Resources, caller).SingleOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (visible is not null)
        {
            return visible;
        }

        var archived = await db.Resources.SingleOrDefaultAsync(r => r.Id == id && r.ArchivedAt != null, cancellationToken);
        return archived is not null && (archived.OwnerId == caller || IsSystemAdmin) ? archived : null;
    }

    public bool CanChange(Resource resource, Guid caller) => resource.OwnerId == caller || IsSystemAdmin;

    /// <summary>A change made by a System Admin to a resource they do not own: it is written to the audit log.</summary>
    public bool IsOverride(Resource resource, Guid caller) => resource.OwnerId != caller && IsSystemAdmin;
}
