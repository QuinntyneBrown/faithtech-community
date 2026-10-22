using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>Who may do what with events, read from the caller's roles (L2-020, L2-022, L2-025).</summary>
public class EventPermissions(ICurrentUser current, IApplicationDbContext db)
{
    private static readonly Role[] Managers = [Role.EventLead, Role.CityLead, Role.SystemAdmin];

    /// <summary>Event Leads, City Leads and System Admins create, edit and cancel events.</summary>
    public bool CanManageEvents => Managers.Any(current.HasRole);

    /// <summary>A System Admin acting without an event role is overriding, and is audited.</summary>
    public bool IsAdminOverride =>
        current.HasRole(Role.SystemAdmin) && !current.HasRole(Role.EventLead) && !current.HasRole(Role.CityLead);

    /// <summary>The caller's profile id, or null for an anonymous caller or an unknown account.</summary>
    public Task<Guid?> CallerProfileIdAsync(CancellationToken cancellationToken = default) =>
        current.UserId is { } userId
            ? db.Users.Where(u => u.Id == userId).Select(u => (Guid?)u.ProfileId).SingleOrDefaultAsync(cancellationToken)
            : Task.FromResult<Guid?>(null);
}
