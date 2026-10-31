using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests;

/// <summary>
/// Domain tests arrange roles by the former <see cref="Role"/> values, each a definition whose key is the value and whose
/// capabilities are FaithTech's seed (L2-151 AC2).
/// </summary>
public static class TestRoles
{
    private static readonly string[] CreateLead =
    [
        Capability.ViewAttendees, Capability.ManageAttendance, Capability.KeepContacts, Capability.ViewPartners,
        Capability.ManagePartners, Capability.InviteMembers, Capability.JoinWorkspaces, Capability.AddResources,
    ];

    private static readonly Dictionary<Role, string[]> Capabilities = new()
    {
        [Role.CityLead] =
        [
            Capability.ManageEvents, Capability.ViewAttendees, Capability.ManageAttendance, Capability.KeepContacts,
            Capability.ViewPartners, Capability.ManagePartners, Capability.InviteMembers, Capability.ConnectLink,
            Capability.OwnWorkspaces, Capability.JoinWorkspaces, Capability.ViewPeopleDirectory, Capability.AssignRoles,
            Capability.AddResources,
        ],
        [Role.EventLead] = [Capability.ManageEvents, .. CreateLead],
        [Role.CreateLead] = CreateLead,
        [Role.CommunicationsLead] = [.. CreateLead, Capability.SendAnnouncements],
        [Role.Staff] =
        [
            Capability.ViewAttendees, Capability.ViewPartners, Capability.ReadAllWorkspaces, Capability.ViewPeopleDirectory,
            Capability.ViewReports, Capability.AddResources,
        ],
        [Role.Volunteer] = [Capability.JoinWorkspaces],
        [Role.ProductEngineer] = [],
        [Role.Attendee] = [],
        [Role.SystemAdmin] = [Capability.AdministerOrganisation],
    };

    private static readonly Dictionary<Role, RoleDefinition> Definitions = Enum.GetValues<Role>().ToDictionary(
        role => role,
        role => new RoleDefinition(Guid.NewGuid(), role.ToString(), role.ToString(), string.Empty, Capabilities[role], (int)role));

    public static RoleDefinition Definition(Role role) => Definitions[role];

    extension(Profile profile)
    {
        public void AddRole(Role role, Guid grantedBy, DateTime nowUtc) => profile.AddRole(Definition(role), grantedBy, nowUtc);

        public void RemoveRole(Role role) => profile.RemoveRole(Definition(role).Id);
    }

    extension(ProfileRole held)
    {
        public Role Role => Enum.Parse<Role>(held.Definition!.Key);
    }
}
