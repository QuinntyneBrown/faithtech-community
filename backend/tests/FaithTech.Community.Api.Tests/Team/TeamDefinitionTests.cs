// Traces to: L2-046; L2-135 AC3
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Team;

// The team list and partner owners read role definitions, never a role name (ADR 0033).
public class TeamDefinitionTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private Task<ProfileClients.Member> HoldingAsync(string name, bool showOnTeam, params string[] capabilities) =>
        factory.WithDbAsync(async db =>
        {
            var definition = new RoleDefinition(Guid.NewGuid(), $"test-{Guid.NewGuid():N}", $"Role of {name}", "Defined by a test.", capabilities, 300);
            definition.SetFlags(showOnTeam, chapterScopable: false, isOversight: false);
            db.RoleDefinitions.Add(definition);
            await db.SaveChangesAsync();
            return definition.Id;
        }).ContinueWith(async id =>
        {
            var member = await factory.AddMemberAsync(name);
            await factory.WithDbAsync(async db =>
            {
                (await db.Profiles.SingleAsync(p => p.Id == member.ProfileId)).AddRole(await id, Guid.Empty, DateTime.UtcNow);
                return await db.SaveChangesAsync();
            });
            return member;
        }).Unwrap();

    [Fact]
    public async Task The_team_lists_holders_of_a_role_shown_on_the_team_and_no_one_else()
    {
        await HoldingAsync("Ada Shown", showOnTeam: true);
        await HoldingAsync("Bea Hidden", showOnTeam: false, Capability.ManageEvents);
        var viewer = await factory.AddMemberAsync("Viewer Person");

        var json = await factory.ClientFor(viewer).GetFromJsonAsync<JsonElement>("/api/team?pageSize=100");

        var names = json.GetProperty("members").EnumerateArray().Select(m => m.GetProperty("name").GetString()).ToList();
        Assert.Contains("Ada Shown", names);
        Assert.DoesNotContain("Bea Hidden", names);
    }

    [Fact]
    public async Task A_partner_can_be_owned_by_a_holder_of_ManagePartners()
    {
        var owner = await HoldingAsync("Cal Manager", showOnTeam: false, Capability.ManagePartners);
        await HoldingAsync("Dee Viewer", showOnTeam: false, Capability.ViewPartners);

        var owners = await factory.ClientFor(owner).GetFromJsonAsync<JsonElement>("/api/partners/owners");

        var names = owners.EnumerateArray().Select(o => o.GetProperty("name").GetString()).ToList();
        Assert.Contains("Cal Manager", names);
        Assert.DoesNotContain("Dee Viewer", names);
    }
}
