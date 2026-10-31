// Traces to: L2-137 AC4, AC5
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Organisations;

// /api/me answers the roles the caller may add and remove, so every picker offers exactly those.
public class GrantableRolesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Me(Guid[] GrantableRoleIds);

    [Fact]
    public async Task A_City_Lead_may_grant_the_six_roles_FaithTechs_rule_names()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");

        var me = await factory.ClientFor(grace, Role.CityLead).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal(
            new[] { Role.EventLead, Role.CreateLead, Role.CommunicationsLead, Role.Volunteer, Role.ProductEngineer, Role.Attendee }
                .Select(r => factory.RoleIdOf(r)).Order(),
            me!.GrantableRoleIds.Order());
    }

    [Fact]
    public async Task An_administrator_may_grant_every_role()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");

        var me = await factory.ClientFor(priya, Role.SystemAdmin).GetFromJsonAsync<Me>("/api/me");

        Assert.Equal(Enum.GetValues<Role>().Select(r => factory.RoleIdOf(r)).Order(), me!.GrantableRoleIds.Order());
    }

    [Fact]
    public async Task A_member_without_AssignRoles_may_grant_nothing()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var me = await factory.ClientFor(ruth, Role.Staff, Role.Volunteer).GetFromJsonAsync<Me>("/api/me");

        Assert.Empty(me!.GrantableRoleIds);
    }
}
