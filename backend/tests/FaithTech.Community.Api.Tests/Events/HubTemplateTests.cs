// Traces to: L2-169 AC2, L2-171 AC1 to AC3
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Events;

// Hub templates are organisation data (ADR 0041): FaithTech's three come from the seed; code never names them.
public class HubTemplateTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string Templates = "/api/event-hubs/templates";

    private static readonly string[] Every = ["Hero", "Agenda", "Venue", "People", "Links", "Giving", "UpcomingEvents"];

    // L2-169 AC2, L2-171 AC2: the FaithTech seed is the regression case.
    [Fact]
    public async Task A_hub_manager_lists_FaithTechs_templates_in_order_with_what_each_shows()
    {
        var lead = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageEventHubs);

        var templates = (await lead.GetFromJsonAsync<JsonElement[]>(Templates))!;

        Assert.Equal(
            [
                ("Hackathon", "A day of building in teams, with demos at the end."),
                ("Meetup", "An evening of talks and conversation."),
                ("Workshop", "A hands-on session with one facilitator."),
            ],
            templates!.Select(t => (t.GetProperty("name").GetString(), t.GetProperty("description").GetString())));
        Assert.All(templates!, t => Assert.True(Guid.TryParse(t.GetProperty("id").GetString(), out _)));
        string[] Shown(JsonElement t) => [.. t.GetProperty("shown").EnumerateArray().Select(k => k.GetString()!)];
        Assert.Equal(Every, Shown(templates[0]));
        Assert.Equal(Every.Except(["Links"]), Shown(templates[1]));
        Assert.Equal(Every.Except(["Links", "Giving"]), Shown(templates[2]));
    }

    // L2-169 AC2: the list needs ManageEventHubs.
    [Fact]
    public async Task A_member_without_the_capability_gets_403_and_an_anonymous_caller_401()
    {
        var member = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);

        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync(Templates)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Templates)).StatusCode);
    }

    // L2-171 AC3, L2-169 AC1: a provisioned organisation has no templates, and never sees FaithTech's.
    [Fact]
    public async Task Another_organisation_lists_none_of_FaithTechs_templates()
    {
        var northside = await factory.NorthsideClientAsync(Role.EventLead);

        var templates = await northside.GetFromJsonAsync<JsonElement[]>(Templates);

        Assert.Empty(templates!);
    }
}
