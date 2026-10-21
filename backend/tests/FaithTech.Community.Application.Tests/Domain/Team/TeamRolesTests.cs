// Traces to: L2-019
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Team;

namespace FaithTech.Community.Application.Tests.Domain.Team;

public class TeamRolesTests
{
    private static readonly DateTime Now = new(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc);

    private static Profile WithRoles(params Role[] roles)
    {
        var profile = new Profile("Ada");
        foreach (var role in roles)
        {
            profile.AddRole(role, Guid.NewGuid(), Now);
        }

        return profile;
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.Volunteer)]
    public void A_profile_holding_a_lead_or_volunteer_role_is_on_the_team(Role role)
    {
        Assert.True(TeamRoles.IsTeamMember(WithRoles(Role.Attendee, role)));
    }

    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.ProductEngineer)]
    [InlineData(Role.Attendee)]
    [InlineData(Role.SystemAdmin)]
    public void A_profile_holding_only_other_roles_is_not_on_the_team(Role role)
    {
        Assert.False(TeamRoles.IsTeamMember(WithRoles(role)));
    }

    [Fact]
    public void A_profile_that_loses_its_last_team_role_leaves_the_team()
    {
        var profile = WithRoles(Role.Volunteer, Role.Attendee);

        profile.RemoveRole(Role.Volunteer);

        Assert.False(TeamRoles.IsTeamMember(profile));
    }
}
