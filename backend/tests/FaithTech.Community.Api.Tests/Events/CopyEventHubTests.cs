// Traces to: L2-170 AC2, AC4, AC5
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Events;

// Copy a past hub (ADR 0041): every section comes over, with its times moved by the difference of the events' starts.
public class CopyEventHubTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static JsonElement Section(JsonElement hub, string kind) =>
        hub.GetProperty("sections").EnumerateArray().Single(s => s.GetProperty("kind").GetString() == kind);

    private async Task<HttpClient> LeadAsync() =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageEventHubs);

    private static async Task<Guid> HubOfAsync(HttpClient lead, Guid eventId)
    {
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsync(Hub(eventId), null)).StatusCode);
        return eventId;
    }

    // L2-170 AC4: visibility, order and content are copied; Agenda rows and the code freeze move by the shift; a Draft.
    [Fact]
    public async Task Copying_a_hub_brings_every_section_with_its_times_moved_to_the_new_event()
    {
        var lead = await LeadAsync();
        var source = await factory.AddEventAsync("Toronto Builders Night: October", TimeSpan.FromDays(3));
        var target = await factory.AddEventAsync("Toronto Builders Night: November", TimeSpan.FromDays(31).Add(TimeSpan.FromMinutes(45)));
        await HubOfAsync(lead, source.Id);
        await HubOfAsync(lead, target.Id);
        var doors = source.StartsAt;
        var freeze = source.StartsAt.AddHours(2);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync($"{Hub(source.Id)}/sections/Hero", new { subtitle = "Build for the city" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync($"{Hub(source.Id)}/sections/Agenda", new
        {
            items = new[] { new { startsAt = doors, title = "Doors open", detail = (string?)"Coffee first." }, new { startsAt = freeze, title = "Code freeze", detail = (string?)null } },
        })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync($"{Hub(source.Id)}/sections/Links", new
        {
            submissionUrl = "https://forms.example.org/submit", feedbackUrl = "https://forms.example.org/feedback", codeFreezeAt = freeze,
        })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync($"{Hub(source.Id)}/sections/People", new
        {
            people = new[] { new { profileId = (Guid?)null, name = "Nadia Farouk", line = "Founder, Kestrel Labs", role = "Judge" } },
        })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync(Hub(source.Id), new { sections = new[] { new { kind = "Giving", visible = false } } })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync($"{Hub(source.Id)}/sections/order", new
        {
            kinds = new[] { "Hero", "Links", "Agenda", "Venue", "People", "Giving", "UpcomingEvents" },
        })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PostAsync($"{Hub(source.Id)}/publish", null)).StatusCode);

        var response = await lead.PostAsJsonAsync($"{Hub(target.Id)}/start", new { copyFromEventId = source.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var hub = await response.Content.ReadFromJsonAsync<JsonElement>();
        var shift = target.StartsAt - source.StartsAt;
        Assert.Equal("copy", hub.GetProperty("templateKey").GetString());
        Assert.Equal("Draft", hub.GetProperty("status").GetString());
        Assert.Equal(
            ["Hero", "Links", "Agenda", "Venue", "People", "Giving", "UpcomingEvents"],
            hub.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("kind").GetString()));
        Assert.False(Section(hub, "Giving").GetProperty("visible").GetBoolean());
        Assert.Equal("Build for the city", Section(hub, "Hero").GetProperty("content").GetProperty("subtitle").GetString());
        Assert.Equal(
            [("Doors open", doors + shift), ("Code freeze", freeze + shift)],
            Section(hub, "Agenda").GetProperty("content").GetProperty("items").EnumerateArray()
                .Select(i => (i.GetProperty("title").GetString(), i.GetProperty("startsAt").GetDateTimeOffset())));
        var links = Section(hub, "Links").GetProperty("content");
        Assert.Equal(freeze + shift, links.GetProperty("codeFreezeAt").GetDateTimeOffset());
        Assert.Equal("https://forms.example.org/submit", links.GetProperty("submissionUrl").GetString());
        Assert.Equal("Nadia Farouk",
            Section(hub, "People").GetProperty("content").GetProperty("people")[0].GetProperty("name").GetString());
    }

    // L2-170 AC5: no hub, the same event, an unknown event or another organisation's: 400 and nothing changes.
    [Fact]
    public async Task Copying_from_an_event_without_a_hub_itself_or_another_organisation_is_400()
    {
        var lead = await LeadAsync();
        var target = await HubOfAsync(lead, (await factory.AddEventAsync("Prayer Night", TimeSpan.FromDays(9))).Id);
        var withoutHub = await factory.AddEventAsync("Panel Night", TimeSpan.FromDays(2));
        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        var start = factory.Time.GetUtcNow().AddDays(10);
        var theirEvent = await (await northside.PostAsync("/api/events", new
        {
            title = Isolation.Marker(), description = "An evening.", type = "builders-night", startsAt = start, endsAt = start.AddHours(2),
            city = "Toronto", format = "InPerson", venue = "Kestrel Labs", onlineLink = (string?)null, capacity = 60, visibility = "Public",
        })).CreatedIdAsync();
        Assert.Equal(HttpStatusCode.Created, (await northside.PostAsync(Hub(theirEvent), null)).StatusCode);

        foreach (var from in new[] { withoutHub.Id, target, Guid.NewGuid(), theirEvent })
        {
            var response = await lead.PostAsJsonAsync($"{Hub(target)}/start", new { copyFromEventId = from });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
            Assert.Contains(errors.EnumerateObject(), e => e.Name.Equals("copyFromEventId", StringComparison.OrdinalIgnoreCase)
                && e.Value.EnumerateArray().Any(m => m.GetString() == "Choose a hub to copy."));
        }

        Assert.Equal("blank", (await lead.GetFromJsonAsync<JsonElement>(Hub(target))).GetProperty("templateKey").GetString());
    }

    // L2-170 AC2: the organisation's hubs by event title, newest event first, without the excluded one; 403 without the capability.
    [Fact]
    public async Task The_past_hubs_list_searches_by_title_newest_first_and_stays_in_the_organisation()
    {
        var lead = await LeadAsync();
        var token = Guid.NewGuid().ToString("N")[..8];
        var older = await HubOfAsync(lead, (await factory.AddEventAsync($"Shelters {token} spring", TimeSpan.FromDays(-60))).Id);
        var newer = await HubOfAsync(lead, (await factory.AddEventAsync($"Shelters {token} autumn", TimeSpan.FromDays(20))).Id);
        var excluded = await HubOfAsync(lead, (await factory.AddEventAsync($"Shelters {token} winter", TimeSpan.FromDays(40))).Id);
        await factory.AddEventAsync($"Shelters {token} no hub", TimeSpan.FromDays(10));

        var hubs = (await lead.GetFromJsonAsync<JsonElement[]>($"/api/event-hubs?search={token.ToUpperInvariant()}&excludeEventId={excluded}"))!;

        Assert.Equal([newer, older], hubs.Select(h => h.GetProperty("eventId").GetGuid()));
        Assert.Equal($"Shelters {token} autumn", hubs[0].GetProperty("title").GetString());
        Assert.True(hubs[0].TryGetProperty("startsAt", out _));

        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        Assert.Empty((await northside.GetFromJsonAsync<JsonElement[]>($"/api/event-hubs?search={token}"))!);
        var member = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync("/api/event-hubs")).StatusCode);
    }

    // L2-170 AC1, AC2: at most 20 hubs.
    [Fact]
    public async Task The_past_hubs_list_holds_at_most_twenty()
    {
        var lead = await LeadAsync();
        var token = Guid.NewGuid().ToString("N")[..8];
        for (var i = 0; i < 21; i++)
        {
            await HubOfAsync(lead, (await factory.AddEventAsync($"Night {token} {i}", TimeSpan.FromDays(i + 1))).Id);
        }

        Assert.Equal(20, (await lead.GetFromJsonAsync<JsonElement[]>($"/api/event-hubs?search={token}"))!.Length);
    }
}
