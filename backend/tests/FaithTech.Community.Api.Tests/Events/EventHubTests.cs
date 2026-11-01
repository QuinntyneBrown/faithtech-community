// Traces to: L2-153 AC3, AC5, AC7, AC9; L2-154 AC1 to AC3; L2-155 AC1 to AC6
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

// Every rule is proven with a role defined in the test (ADR 0033); the FaithTech seed is the regression case.
public class EventHubTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly string[] Kinds = ["Hero", "Agenda", "Venue", "People", "Links", "Giving", "UpcomingEvents"];

    private async Task<HttpClient> HolderAsync(string name = "Grace Okonkwo") =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync(name), Capability.ManageEventHubs);

    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    // L2-153 AC3, L2-155 AC2: a holder creates a Draft hub, Blank, one visible section per kind.
    [Fact]
    public async Task A_holder_of_ManageEventHubs_creates_a_draft_hub_with_every_section_shown()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));

        var response = await (await HolderAsync()).PostAsync(Hub(existing.Id), null);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(Hub(existing.Id), response.Headers.Location?.OriginalString);
        var id = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var hub = await factory.WithDbAsync(db => db.EventHubs.AsNoTracking().Include(h => h.Sections).SingleAsync(h => h.Id == id));
        Assert.Equal((existing.Id, EventHubStatus.Draft, "blank"), (hub.EventId, hub.Status, hub.TemplateKey));
        Assert.Equal(Kinds, hub.Sections.OrderBy(s => s.Order).Select(s => s.Kind.ToString()));
        Assert.All(hub.Sections, s => Assert.True(s.Visible));
        Assert.All(hub.Sections, s => Assert.Equal("{}", s.Content));
    }

    // L2-155 AC2: without the capability the answer is 403 and nothing is created.
    [Fact]
    public async Task Without_ManageEventHubs_creating_reading_and_saving_a_hub_are_403()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var other = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents, Capability.ViewAttendees);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.PostAsync(Hub(existing.Id), null)).StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.EventHubs.AnyAsync(h => h.EventId == existing.Id)));

        await (await HolderAsync()).PostAsync(Hub(existing.Id), null);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.GetAsync(Hub(existing.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutAsJsonAsync(Hub(existing.Id), Save())).StatusCode);
    }

    // L2-153 AC9, L2-155 AC5: one hub per event; a cancelled event has none.
    [Fact]
    public async Task A_second_hub_for_the_same_event_and_a_hub_for_a_cancelled_event_are_409()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var cancelled = await factory.AddEventAsync("Prayer Breakfast", TimeSpan.FromDays(7), cancelledBecause: "The venue flooded.");
        var holder = await HolderAsync();

        Assert.Equal(HttpStatusCode.Created, (await holder.PostAsync(Hub(existing.Id), null)).StatusCode);
        var second = await holder.PostAsync(Hub(existing.Id), null);
        var refused = await holder.PostAsync(Hub(cancelled.Id), null);

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Contains("This event already has a hub.", await second.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Contains("This event is cancelled, so it can’t have a hub.", await refused.Content.ReadAsStringAsync());
        Assert.Equal(1, await factory.WithDbAsync(db => db.EventHubs.CountAsync(h => h.EventId == existing.Id || h.EventId == cancelled.Id)));
    }

    // L2-155 AC4: an unknown event, or another organisation's, is not found.
    [Fact]
    public async Task An_unknown_event_and_another_organisations_event_and_hub_are_404()
    {
        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        var start = factory.Time.GetUtcNow().AddDays(10);
        var theirs = await (await northside.PostAsync("/api/events", new
        {
            title = Isolation.Marker(), description = "An evening.", type = "builders-night", startsAt = start, endsAt = start.AddHours(2),
            city = "Toronto", format = "InPerson", venue = "Kestrel Labs", onlineLink = (string?)null, capacity = 60, visibility = "Public",
        })).CreatedIdAsync();
        Assert.Equal(HttpStatusCode.Created, (await northside.PostAsync(Hub(theirs), null)).StatusCode);
        var admin = await factory.FaithTechAdminAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync(Hub(Guid.NewGuid()), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync(Hub(theirs), null)).StatusCode);
        await admin.AssertNotFoundAsync(Hub(theirs));
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync(Hub(theirs), Save())).StatusCode);
    }

    // L2-155 AC2: an administrator without the capability succeeds as an override, audited; a holder is not audited.
    [Fact]
    public async Task An_administrator_without_ManageEventHubs_is_audited_and_a_holder_is_not()
    {
        var mine = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var theirs = await factory.AddEventAsync("Hack Night", TimeSpan.FromDays(7));
        var adminMember = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientWithCapabilities(adminMember, Capability.AdministerOrganisation);

        Assert.Equal(HttpStatusCode.Created, (await (await HolderAsync()).PostAsync(Hub(mine.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsync(Hub(theirs.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync(Hub(theirs.Id), Save())).StatusCode);

        var entries = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(a => a.TargetType == "EventHub").OrderBy(a => a.Id).ToListAsync());
        var hubOfTheirs = await factory.WithDbAsync(db => db.EventHubs.Where(h => h.EventId == theirs.Id).Select(h => h.Id).SingleAsync());
        Assert.Equal(
            [("event_hub.created", adminMember.ProfileId, hubOfTheirs.ToString()), ("event_hub.updated", adminMember.ProfileId, hubOfTheirs.ToString())],
            entries.Select(e => (e.Action, e.ActorId, e.TargetId)).Order().ToList());
    }

    // L2-155 AC1, AC3: FaithTech's City Lead and Event Lead carry the capability, even when their role is chapter-tagged; Staff does not.
    [Fact]
    public async Task FaithTech_city_and_event_leads_manage_hubs_for_any_chapter_and_staff_cannot()
    {
        var vancouver = await factory.AddEventAsync("Vancouver Builders Night", TimeSpan.FromDays(7), city: "Vancouver");
        var wide = await factory.AddEventAsync("Global Prayer Night", TimeSpan.FromDays(7), city: null);
        var toronto = await factory.ChapterIdAsync("Toronto");
        var tagged = await factory.AddMemberAsync("Ruth Alvarez",
            p => p.AddRole(TestRoles.DefinitionId(Role.EventLead), Guid.Empty, DateTime.UtcNow, toronto));
        var cityLead = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), Role.CityLead);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Jonah Bell"), Role.Staff);

        Assert.Equal(HttpStatusCode.Created, (await factory.ClientFor(tagged).PostAsync(Hub(vancouver.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await cityLead.PostAsync(Hub(wide.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync(Hub(wide.Id))).StatusCode);
    }

    // L2-155 AC6: hubs are not for anonymous callers until they are published (a later requirement).
    [Fact]
    public async Task Anonymous_callers_get_401()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7), visibility: EventVisibility.Public);
        var anonymous = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync(Hub(existing.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(Hub(existing.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsJsonAsync(Hub(existing.Id), Save())).StatusCode);
    }

    // L2-154 AC1, AC2: the home reads the hub with its link, the event's facts and each section's state.
    [Fact]
    public async Task The_hub_home_shows_the_link_the_events_facts_and_each_sections_state()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var holder = await HolderAsync();
        await holder.PostAsync(Hub(existing.Id), null);
        Assert.Equal(HttpStatusCode.NoContent, (await holder.PutAsJsonAsync(Hub(existing.Id), Save("blank", ("Giving", false)))).StatusCode);

        var hub = await holder.GetFromJsonAsync<JsonElement>(Hub(existing.Id));

        Assert.Equal(("Draft", "blank"), (hub.GetProperty("status").GetString(), hub.GetProperty("templateKey").GetString()));
        Assert.EndsWith($"/public/events/{existing.Id}/hub", hub.GetProperty("link").GetString());
        Assert.Equal("Builders Night", hub.GetProperty("event").GetProperty("title").GetString());
        Assert.Equal("Kestrel Labs, 220 King St W", hub.GetProperty("event").GetProperty("venue").GetString());
        Assert.EndsWith($"/public/events/{existing.Id}", hub.GetProperty("event").GetProperty("rsvpLink").GetString());
        Assert.Equal(
            [("Hero", "Ready"), ("Agenda", "NeedsInfo"), ("Venue", "Ready"), ("People", "NeedsInfo"), ("Links", "NeedsInfo"),
                ("Giving", "Hidden"), ("UpcomingEvents", "Ready")],
            hub.GetProperty("sections").EnumerateArray().Select(x => (x.GetProperty("kind").GetString()!, x.GetProperty("state").GetString()!)));
    }

    // L2-154 AC2, AC3: the hub stores none of the event's facts, so an online event's Venue needs info and an edit shows at once.
    [Fact]
    public async Task The_hub_reads_the_event_live_and_an_online_events_venue_needs_info()
    {
        var online = await factory.AddEventAsync("Prayer Online", TimeSpan.FromDays(7), format: EventFormat.Online);
        var holder = await HolderAsync();
        await holder.PostAsync(Hub(online.Id), null);
        await factory.WithDbAsync(async db =>
        {
            var e = await db.Events.SingleAsync(x => x.Id == online.Id);
            db.Entry(e).Property(x => x.Title).CurrentValue = "Prayer Online, renamed";
            return await db.SaveChangesAsync();
        });

        var hub = await holder.GetFromJsonAsync<JsonElement>(Hub(online.Id));

        Assert.Equal("Prayer Online, renamed", hub.GetProperty("event").GetProperty("title").GetString());
        Assert.Equal("NeedsInfo", hub.GetProperty("sections").EnumerateArray().Single(x => x.GetProperty("kind").GetString() == "Venue")
            .GetProperty("state").GetString());
    }

    // L2-153 AC5, AC7: a save sets the sections it names and keeps the others; saving again changes them back.
    [Fact]
    public async Task Saving_hides_the_unticked_sections_and_keeps_the_ones_left_out()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var holder = await HolderAsync();
        await holder.PostAsync(Hub(existing.Id), null);

        await holder.PutAsJsonAsync(Hub(existing.Id), Save("blank", ("People", false), ("giving", false)));
        await holder.PutAsJsonAsync(Hub(existing.Id), Save("blank", ("People", true)));

        var visible = await factory.WithDbAsync(db => db.HubSections.AsNoTracking()
            .Where(s => s.EventHubId == db.EventHubs.Single(h => h.EventId == existing.Id).Id)
            .ToDictionaryAsync(s => s.Kind.ToString(), s => s.Visible));
        Assert.True(visible["People"]);
        Assert.False(visible["Giving"]);
        Assert.Equal(6, visible.Values.Count(v => v));
    }

    // L2-155 AC5: only Blank, and only known sections named once.
    [Theory]
    [InlineData("hackathon", "Hero", "templateKey", "Choose a starting point from the list.")]
    [InlineData("blank", "Parking", "sections", "Choose sections from the list.")]
    [InlineData("blank", "7", "sections", "Choose sections from the list.")]
    public async Task An_unknown_starting_point_or_section_is_400(string templateKey, string kind, string field, string message)
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var holder = await HolderAsync();
        await holder.PostAsync(Hub(existing.Id), null);

        var response = await holder.PutAsJsonAsync(Hub(existing.Id), Save(templateKey, (kind, false)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Contains(errors.EnumerateObject(), e => e.Name.Equals(field, StringComparison.OrdinalIgnoreCase)
            && e.Value.EnumerateArray().Any(m => m.GetString() == message));
    }

    [Fact]
    public async Task A_section_named_twice_is_400()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var holder = await HolderAsync();
        await holder.PostAsync(Hub(existing.Id), null);

        var response = await holder.PutAsJsonAsync(Hub(existing.Id), Save("blank", ("Hero", false), ("hero", true)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // L2-154 AC4: an event without a hub has no home to read or save.
    [Fact]
    public async Task Reading_or_saving_the_hub_of_an_event_without_one_is_404()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var holder = await HolderAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await holder.GetAsync(Hub(existing.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await holder.PutAsJsonAsync(Hub(existing.Id), Save())).StatusCode);
    }

    // L2-153 AC1: the event page learns whether the caller manages hubs and whether the event has one.
    [Fact]
    public async Task The_event_detail_carries_the_hub_and_whether_the_caller_may_manage_it()
    {
        var existing = await factory.AddEventAsync("Builders Night", TimeSpan.FromDays(7));
        var holder = await HolderAsync();
        var member = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);

        var before = await holder.GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");
        var id = await (await holder.PostAsync(Hub(existing.Id), null)).CreatedIdAsync();
        var after = await holder.GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");
        var theirs = await member.GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");

        Assert.Equal((true, JsonValueKind.Null), (before.GetProperty("canManageHub").GetBoolean(), before.GetProperty("hubId").ValueKind));
        Assert.Equal(id, after.GetProperty("hubId").GetGuid());
        Assert.False(theirs.GetProperty("canManageHub").GetBoolean());
    }

    private static object Save(string templateKey = "blank", params (string Kind, bool Visible)[] sections) => new
    {
        templateKey,
        sections = sections.Select(s => new { kind = s.Kind, visible = s.Visible }).ToArray(),
    };
}
