using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Domain.Team;

public static class TeamRoles
{
    public static IReadOnlySet<Role> All { get; } =
        new HashSet<Role> { Role.CityLead, Role.EventLead, Role.CreateLead, Role.CommunicationsLead, Role.Volunteer };

    public static bool IsTeamMember(Profile profile) => profile.Roles.Any(r => All.Contains(r.Role));
}
