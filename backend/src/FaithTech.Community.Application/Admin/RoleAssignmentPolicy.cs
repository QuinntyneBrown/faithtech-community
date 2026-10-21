using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Admin;

/// <summary>
/// Who may change which role (L2-009): a City Lead the six non-administrative roles, a System Admin any role.
/// The web app mirrors this in <c>assignableRoles</c> (ADR 0005) only to hide options.
/// </summary>
public class RoleAssignmentPolicy(ICurrentUser current)
{
    public static readonly IReadOnlyList<Role> CityLeadRoles =
        [Role.EventLead, Role.CreateLead, Role.CommunicationsLead, Role.Volunteer, Role.ProductEngineer, Role.Attendee];

    public bool CanChangeRoles => current.HasRole(Role.SystemAdmin) || current.HasRole(Role.CityLead);

    public bool CanChange(Role role) =>
        current.HasRole(Role.SystemAdmin) || (current.HasRole(Role.CityLead) && CityLeadRoles.Contains(role));

    /// <summary>A City Lead's changes notify the owner; a System Admin's are audited instead (assign-roles design).</summary>
    public bool NotifiesOwner => !current.HasRole(Role.SystemAdmin) && current.HasRole(Role.CityLead);
}
