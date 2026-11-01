// Traces to: L2-169 AC3, AC5, L2-155 AC5
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

// Applying a starting point replaces every section's visibility, order and content (ADR 0041).
public class StartEventHubTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);

    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static string Start(Guid eventId) => $"{Hub(eventId)}/start";

    private async Task<HttpClient> LeadAsync() =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageEventHubs);

    private static async Task<string> TemplateIdAsync(HttpClient lead, string name) =>
        (await lead.GetFromJsonAsync<JsonElement[]>("/api/event-hubs/templates"))!
            .Single(t => t.GetProperty("name").GetString() == name).GetProperty("id").GetString()!;

    private static JsonElement Section(JsonElement hub, string kind) =>
        hub.GetProperty("sections").EnumerateArray().Single(s => s.GetProperty("kind").GetString() == kind);

    private static Dictionary<string, bool> Visibility(JsonElement hub) =>
        hub.GetProperty("sections").EnumerateArray()
            .ToDictionary(s => s.GetProperty("kind").GetString()!, s => s.GetProperty("visible").GetBoolean());

    private async Task<(Guid EventId, DateTimeOffset StartsAt, HttpClient Lead)> HubAsync()
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Week);
        var lead = await LeadAsync();
        Assert.Equal(HttpStatusCode.Created, (await lead.PostAsync(Hub(e.Id), null)).StatusCode);
        return (e.Id, e.StartsAt, lead);
    }

    // L2-169 AC3: a template sets visibility and fills its defaults; Agenda rows are timed from the event's start.
    [Fact]
    public async Task Applying_a_template_shows_its_sections_and_fills_its_defaults_timed_from_the_event()
    {
        var (eventId, startsAt, lead) = await HubAsync();
        var meetup = await TemplateIdAsync(lead, "Meetup");

        var response = await lead.PostAsJsonAsync(Start(eventId), new { templateId = meetup });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var hub = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(meetup, hub.GetProperty("templateKey").GetString());
        Assert.Equal(
            ["Hero", "Agenda", "Venue", "People", "Links", "Giving", "UpcomingEvents"],
            hub.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("kind").GetString()));
        Assert.False(Visibility(hub)["Links"]);
        Assert.Equal(6, Visibility(hub).Values.Count(v => v));
        Assert.Equal("An evening of conversation for Christians who build.",
            Section(hub, "Hero").GetProperty("content").GetProperty("subtitle").GetString());
        var items = Section(hub, "Agenda").GetProperty("content").GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(
            [("Doors open", startsAt), ("Welcome and prayer", startsAt.AddMinutes(30)), ("Talks", startsAt.AddMinutes(45)),
                ("Conversation and connection", startsAt.AddMinutes(90))],
            items.Select(i => (i.GetProperty("title").GetString(), i.GetProperty("startsAt").GetDateTimeOffset())));
        Assert.Equal("Grab a drink and find a seat.", items[0].GetProperty("detail").GetString());
        Assert.Equal("Help us host the next one.", Section(hub, "Giving").GetProperty("content").GetProperty("line").GetString());
        Assert.Equal(3, Section(hub, "UpcomingEvents").GetProperty("content").GetProperty("count").GetInt32());
        Assert.Equal("Ready", Section(hub, "Hero").GetProperty("state").GetString());
        Assert.Equal("Ready", Section(hub, "Agenda").GetProperty("state").GetString());
    }

    // L2-169 AC3: choosing again replaces what the last choice filled; Blank empties and shows every section.
    [Fact]
    public async Task Applying_another_starting_point_replaces_the_last_one()
    {
        var (eventId, _, lead) = await HubAsync();
        Assert.Equal(HttpStatusCode.OK, (await lead.PostAsJsonAsync(Start(eventId), new { templateId = await TemplateIdAsync(lead, "Hackathon") })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await lead.PutAsJsonAsync($"{Hub(eventId)}/sections/order", new
        {
            kinds = new[] { "Giving", "Hero", "Agenda", "Venue", "People", "Links", "UpcomingEvents" },
        })).StatusCode);

        var workshop = await (await lead.PostAsJsonAsync(Start(eventId), new { templateId = await TemplateIdAsync(lead, "Workshop") }))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Hero", workshop.GetProperty("sections")[0].GetProperty("kind").GetString());
        Assert.Equal("Bring your laptop. We’ll learn by doing.",
            Section(workshop, "Hero").GetProperty("content").GetProperty("subtitle").GetString());
        Assert.False(Visibility(workshop)["Giving"]);
        Assert.Equal(JsonValueKind.Null, Section(workshop, "Giving").GetProperty("content").GetProperty("line").ValueKind);

        var blank = await (await lead.PostAsJsonAsync(Start(eventId), new { })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("blank", blank.GetProperty("templateKey").GetString());
        Assert.All(Visibility(blank).Values, Assert.True);
        Assert.Equal(JsonValueKind.Null, Section(blank, "Hero").GetProperty("content").GetProperty("subtitle").ValueKind);
        Assert.Empty(Section(blank, "Agenda").GetProperty("content").GetProperty("items").EnumerateArray());
    }

    // L2-155 AC5: a save without a starting point keeps the applied one.
    [Fact]
    public async Task A_save_without_a_starting_point_keeps_the_applied_one()
    {
        var (eventId, _, lead) = await HubAsync();
        var hackathon = await TemplateIdAsync(lead, "Hackathon");
        await lead.PostAsJsonAsync(Start(eventId), new { templateId = hackathon });

        var save = await lead.PutAsJsonAsync(Hub(eventId), new { sections = new[] { new { kind = "People", visible = false } } });

        Assert.Equal(HttpStatusCode.NoContent, save.StatusCode);
        var hub = await lead.GetFromJsonAsync<JsonElement>(Hub(eventId));
        Assert.Equal(hackathon, hub.GetProperty("templateKey").GetString());
        Assert.False(Visibility(hub)["People"]);
    }

    // L2-169 AC5: an unknown template is 400 and nothing changes.
    [Fact]
    public async Task An_unknown_template_is_400_and_nothing_changes()
    {
        var (eventId, _, lead) = await HubAsync();

        var response = await lead.PostAsJsonAsync(Start(eventId), new { templateId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Contains(errors.EnumerateObject(), e => e.Name.Equals("templateId", StringComparison.OrdinalIgnoreCase)
            && e.Value.EnumerateArray().Any(m => m.GetString() == "Choose a starting point from the list."));
        var hub = await lead.GetFromJsonAsync<JsonElement>(Hub(eventId));
        Assert.Equal("blank", hub.GetProperty("templateKey").GetString());
    }

    // L2-169 AC5: 403 without the capability, 404 for another organisation's event or an event without a hub.
    [Fact]
    public async Task Starting_needs_the_capability_a_hub_and_an_event_of_the_organisation()
    {
        var (eventId, _, _) = await HubAsync();
        var member = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);
        var withoutHub = await factory.AddEventAsync("Prayer Night", Week);
        var northside = await factory.NorthsideClientAsync(Role.EventLead);

        Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync(Start(eventId), new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await (await LeadAsync()).PostAsJsonAsync(Start(withoutHub.Id), new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await northside.PostAsJsonAsync(Start(eventId), new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync(Start(eventId), new { })).StatusCode);
    }

    // L2-169 AC5: every applied starting point is audited, marked as an override for an administrator without the capability.
    [Fact]
    public async Task Applying_a_starting_point_is_audited()
    {
        var e = await factory.AddEventAsync("Hack Night", Week);
        var adminMember = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientWithCapabilities(adminMember, Capability.AdministerOrganisation);
        await admin.PostAsync(Hub(e.Id), null);

        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync(Start(e.Id), new { templateId = await TemplateIdAsync(admin, "Hackathon") })).StatusCode);

        var hubId = await factory.WithDbAsync(db => db.EventHubs.Where(h => h.EventId == e.Id).Select(h => h.Id).SingleAsync());
        var entry = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .SingleAsync(a => a.TargetId == hubId.ToString() && a.Action == "event_hub.started"));
        Assert.Equal(adminMember.ProfileId, entry.ActorId);
    }
}
