using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Domain.Team;

public static class TeamRoles
{
    public static IReadOnlySet<Role> All { get; } =
        new HashSet<Role> { Role.CityLead, Role.EventLead, Role.CreateLead, Role.CommunicationsLead, Role.Volunteer };

    /// <summary>The roles the team list's Leads filter matches (L2-019).</summary>
    public static IReadOnlySet<Role> Leads { get; } =
        new HashSet<Role> { Role.CityLead, Role.EventLead, Role.CreateLead, Role.CommunicationsLead };

    public static bool IsTeamMember(Profile profile) => profile.Roles.Any(r => All.Contains(r.Role));
}
