// Traces to: L2-135 AC3, AC4; L2-009
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Admin;

// Assignment reads AssignRoles and the organisation's grant rules, never a role name (ADR 0033).
public class GrantRuleTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private Task<RoleDefinition> DefineAsync(string key, string[] capabilities, params Guid[] grants) =>
        factory.WithDbAsync(async db =>
        {
            var definition = new RoleDefinition(Guid.NewGuid(), key, key, "Defined by a test.", capabilities, 200);
            definition.SetGrantableRoles(grants);
            db.RoleDefinitions.Add(definition);
            await db.SaveChangesAsync();
            return definition;
        });

    private Task GrantAsync(ProfileClients.Member member, RoleDefinition definition) =>
        factory.WithDbAsync(async db =>
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == member.ProfileId);
            profile.AddRole(definition.Id, Guid.Empty, DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });

    [Fact]
    public async Task A_holder_of_AssignRoles_grants_and_removes_only_the_roles_a_rule_lets_them()
    {
        var helper = await DefineAsync("helper-a", []);
        var steward = await DefineAsync("steward-a", []);
        var grantor = await DefineAsync("grantor-a", [Capability.AssignRoles], helper.Id);
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await GrantAsync(grace, grantor);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var client = factory.ClientFor(grace);

        var granted = await client.PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { Role = helper.Key });
        var refused = await client.PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { Role = steward.Key });
        var removed = await client.DeleteAsync($"/api/profiles/{ruth.ProfileId}/roles/{helper.Key}");

        Assert.Equal((HttpStatusCode.OK, HttpStatusCode.Forbidden, HttpStatusCode.OK), (granted.StatusCode, refused.StatusCode, removed.StatusCode));
    }

    [Fact]
    public async Task A_grant_rule_without_AssignRoles_grants_nothing()
    {
        var helper = await DefineAsync("helper-b", []);
        var grantor = await DefineAsync("grantor-b", [Capability.ViewReports], helper.Id);
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        await GrantAsync(grace, grantor);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var response = await factory.ClientFor(grace).PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { Role = helper.Key });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdministerOrganisation_grants_any_role_without_a_rule()
    {
        var steward = await DefineAsync("steward-c", []);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var admin = factory.ClientWithCapabilities(await factory.AddMemberAsync("Priya Shah"), Capability.AdministerOrganisation);

        var response = await admin.PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { Role = steward.Key });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
