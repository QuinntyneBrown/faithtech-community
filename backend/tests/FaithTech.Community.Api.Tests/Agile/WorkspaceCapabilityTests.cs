// Traces to: L2-135 AC3, AC4; L2-031; L2-037
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Api.Tests.Agile;

// Each rule is proven with a role defined in the test, so it holds for any organisation's roles (ADR 0033).
public class WorkspaceCapabilityTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task OwnWorkspaces_creates_a_workspace_and_JoinWorkspaces_alone_is_refused()
    {
        var owner = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.OwnWorkspaces);
        var joiner = factory.ClientWithCapabilities(await factory.AddMemberAsync("Ruth Alvarez"), Capability.JoinWorkspaces);

        var created = await owner.PostAsJsonAsync("/api/workspaces", new { Name = "Toronto team", Method = "Scrum" });
        var refused = await joiner.PostAsJsonAsync("/api/workspaces", new { Name = "Mine", Method = "Scrum" });

        Assert.Equal((HttpStatusCode.Created, HttpStatusCode.Forbidden), (created.StatusCode, refused.StatusCode));
    }

    [Fact]
    public async Task ReadAllWorkspaces_reads_any_workspace_read_only_and_an_outsider_cannot_find_it()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        factory.ClientWithCapabilities(grace, Capability.OwnWorkspaces);
        var id = await factory.AddWorkspaceAsync(grace);
        var reader = factory.ClientWithCapabilities(await factory.AddMemberAsync("Daniel Reyes"), Capability.ReadAllWorkspaces);
        var outsider = factory.ClientWithCapabilities(await factory.AddMemberAsync("Leah Thompson"), Capability.JoinWorkspaces);

        Assert.Equal(HttpStatusCode.OK, (await reader.GetAsync($"/api/workspaces/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PostAsJsonAsync($"/api/workspaces/{id}/members", new { ProfileIds = new[] { grace.ProfileId } })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync($"/api/workspaces/{id}")).StatusCode);
    }

    [Fact]
    public async Task Only_a_holder_of_JoinWorkspaces_can_be_added_as_a_member()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var owner = factory.ClientWithCapabilities(grace, Capability.OwnWorkspaces);
        var id = await factory.AddWorkspaceAsync(grace);
        var joiner = await factory.AddMemberAsync("Ruth Alvarez");
        factory.ClientWithCapabilities(joiner, Capability.JoinWorkspaces);
        var other = await factory.AddMemberAsync("Marcus Lee");
        factory.ClientWithCapabilities(other, Capability.ViewReports);

        var refused = await owner.PostAsJsonAsync($"/api/workspaces/{id}/members", new { ProfileIds = new[] { other.ProfileId } });
        var added = await owner.PostAsJsonAsync($"/api/workspaces/{id}/members", new { ProfileIds = new[] { joiner.ProfileId } });

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.True(added.IsSuccessStatusCode, await added.Content.ReadAsStringAsync());
    }
}
