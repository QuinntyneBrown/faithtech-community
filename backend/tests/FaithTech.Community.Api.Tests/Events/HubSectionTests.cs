// Traces to: L2-156 AC2, AC4; L2-157 AC2, AC3, AC5 to AC7; L2-158 AC4, AC5; L2-159 AC2; L2-160 AC3; L2-161 AC2 to AC4; L2-162 AC2, AC3
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
public class HubSectionTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly string[] Kinds = ["Hero", "Agenda", "Venue", "People", "Links", "Giving", "UpcomingEvents"];

    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static string Section(Guid eventId, string kind) => $"{Hub(eventId)}/sections/{kind}";

    private async Task<HttpClient> HolderAsync(string name = "Grace Okonkwo") =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync(name), Capability.ManageEventHubs);

    /// <summary>An event a week away with a hub, and a holder who manages it.</summary>
    private async Task<(Event Event, HttpClient Holder)> HubAsync(
        string title = "Builders Night", string? city = "Toronto", EventVisibility visibility = EventVisibility.Public)
    {
        var e = await factory.AddEventAsync(title, TimeSpan.FromDays(7), city: city, visibility: visibility);
        var holder = await HolderAsync();
        Assert.Equal(HttpStatusCode.Created, (await holder.PostAsync(Hub(e.Id), null)).StatusCode);
        return (e, holder);
    }

    private static async Task<JsonElement> SectionOf(HttpClient client, Guid eventId, string kind) =>
        (await client.GetFromJsonAsync<JsonElement>(Hub(eventId))).GetProperty("sections").EnumerateArray()
            .Single(s => s.GetProperty("kind").GetString() == kind);

    private static async Task<IDictionary<string, string[]>> ErrorsOf(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("errors").EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.EnumerateArray().Select(v => v.GetString()!).ToArray(), StringComparer.OrdinalIgnoreCase);
    }

    // L2-157 AC2, L2-159 AC2, L2-156 AC2: saving an agenda stores its rows and makes the section Ready.
    [Fact]
    public async Task Saving_an_agenda_stores_its_rows_in_the_given_order_and_makes_it_ready()
    {
        var (e, holder) = await HubAsync();
        var doors = e.StartsAt;
        var talks = e.StartsAt.AddMinutes(45);

        var response = await holder.PutAsJsonAsync(Section(e.Id, "Agenda"), new
        {
            items = new object[]
            {
                new { startsAt = talks, title = "  Lightning talks  ", detail = "Five minutes each." },
                new { startsAt = doors, title = "Doors open", detail = (string?)null },
            },
            ignored = "never stored",
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var agenda = await SectionOf(holder, e.Id, "Agenda");
        Assert.Equal("Ready", agenda.GetProperty("state").GetString());
        var items = agenda.GetProperty("content").GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(["Lightning talks", "Doors open"], items.Select(i => i.GetProperty("title").GetString()));
        Assert.Equal(talks, items[0].GetProperty("startsAt").GetDateTimeOffset());
        var stored = await factory.WithDbAsync(db => db.HubSections.AsNoTracking()
            .SingleAsync(s => s.Kind == HubSectionKind.Agenda && s.EventHubId == db.EventHubs.Single(h => h.EventId == e.Id).Id));
        Assert.DoesNotContain("ignored", stored.Content);
    }

    // L2-157 AC3 with L2-158 to L2-162: content that breaks its kind's schema is 400, keyed by the field, and nothing is stored.
    [Theory]
    [InlineData("Hero", """{"subtitle":"__141__"}""", "subtitle", "Use 140 characters or fewer.")]
    [InlineData("Agenda", """{"items":[{"startsAt":null,"title":"Doors open"}]}""", "items[0].startsAt", "Enter a time.")]
    [InlineData("Agenda", """{"items":[{"startsAt":"2026-11-06T23:30:00Z","title":" "}]}""", "items[0].title", "Say what’s happening.")]
    [InlineData("Agenda", """{"items":[{"startsAt":"2026-11-06T23:30:00Z","title":"__101__"}]}""", "items[0].title", "Use 100 characters or fewer.")]
    [InlineData("Agenda", "__41_ROWS__", "items", "You can add up to 40 rows.")]
    [InlineData("Venue", """{"directions":"__501__"}""", "directions", "Use 500 characters or fewer.")]
    [InlineData("People", """{"people":[{"name":" ","role":"Mentor"}]}""", "people[0].name", "Enter their name.")]
    [InlineData("People", """{"people":[{"name":"Abby Brooks","role":"Host"}]}""", "people[0].role", "Choose mentor, judge or speaker.")]
    [InlineData("People", """{"people":[{"profileId":"__RANDOM__","role":"Judge"}]}""", "people[0].profileId", "Choose a member from the search.")]
    [InlineData("Links", """{"submissionUrl":"http://forms.example.org/submit"}""", "submissionUrl", "Use a link that starts with https://")]
    [InlineData("Links", """{"feedbackUrl":"not a link"}""", "feedbackUrl", "Use a link that starts with https://")]
    [InlineData("Links", """{"codeFreezeAt":"2026-11-06T23:30:00Z"}""", "codeFreezeAt", "Pick a time from the agenda.")]
    [InlineData("Giving", """{"line":"__201__"}""", "line", "Use 200 characters or fewer.")]
    [InlineData("UpcomingEvents", """{"count":7}""", "count", "Choose between 1 and 6.")]
    [InlineData("UpcomingEvents", """{"count":0}""", "count", "Choose between 1 and 6.")]
    public async Task Content_that_breaks_its_kinds_schema_is_400_next_to_the_field(string kind, string body, string field, string message)
    {
        var (e, holder) = await HubAsync();
        var json = body
            .Replace("__141__", new string('a', 141)).Replace("__101__", new string('a', 101))
            .Replace("__501__", new string('a', 501)).Replace("__201__", new string('a', 201))
            .Replace("__RANDOM__", Guid.NewGuid().ToString());
        if (json == "__41_ROWS__")
        {
            json = JsonSerializer.Serialize(new
            {
                items = Enumerable.Range(0, 41).Select(i => new { startsAt = e.StartsAt.AddMinutes(i), title = $"Row {i}" }),
            });
        }

        var response = await holder.PutAsync(Section(e.Id, kind), new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

        var errors = await ErrorsOf(response);
        Assert.Equal([message], errors[field]);
        Assert.Equal("{}", await factory.WithDbAsync(db => db.HubSections.AsNoTracking()
            .Where(s => s.EventHubId == db.EventHubs.Single(h => h.EventId == e.Id).Id && s.Kind.ToString() == kind)
            .Select(s => s.Content).SingleAsync()));
    }

    // L2-160 AC3: a code freeze is picked from the agenda; links make Submission and feedback Ready.
    [Fact]
    public async Task A_code_freeze_from_the_agenda_and_https_links_make_submission_and_feedback_ready()
    {
        var (e, holder) = await HubAsync();
        var freeze = e.StartsAt.AddHours(1);
        await holder.PutAsJsonAsync(Section(e.Id, "Agenda"), new { items = new[] { new { startsAt = freeze, title = "Code freeze" } } });

        var response = await holder.PutAsJsonAsync(Section(e.Id, "Links"), new
        {
            submissionUrl = "https://forms.example.org/submit", feedbackUrl = (string?)null, codeFreezeAt = freeze,
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var links = await SectionOf(holder, e.Id, "Links");
        Assert.Equal("Ready", links.GetProperty("state").GetString());
        Assert.Equal("https://forms.example.org/submit", links.GetProperty("content").GetProperty("submissionUrl").GetString());
        Assert.Equal(freeze, links.GetProperty("content").GetProperty("codeFreezeAt").GetDateTimeOffset());
    }

    // L2-161 AC2, AC3, AC5: members are stored by id and read live; guests stay on the hub and never become profiles.
    [Fact]
    public async Task People_store_members_by_id_read_their_name_live_and_keep_guests_on_the_hub_only()
    {
        var (e, holder) = await HubAsync();
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var profiles = await factory.WithDbAsync(db => db.Profiles.CountAsync());

        var response = await holder.PutAsJsonAsync(Section(e.Id, "People"), new
        {
            people = new object[]
            {
                new { profileId = ruth.ProfileId, name = "Typed Name Ignored", role = "Speaker" },
                new { profileId = (Guid?)null, name = "Abby Brooks", line = "Founder, Kestrel Labs", role = "Judge" },
            },
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(profiles, await factory.WithDbAsync(db => db.Profiles.CountAsync()));
        var stored = await factory.WithDbAsync(db => db.HubSections.AsNoTracking()
            .SingleAsync(s => s.Kind == HubSectionKind.People && s.EventHubId == db.EventHubs.Single(h => h.EventId == e.Id).Id));
        Assert.DoesNotContain("Typed Name Ignored", stored.Content);
        Assert.DoesNotContain("Ruth Alvarez", stored.Content);

        await factory.WithDbAsync(async db =>
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == ruth.ProfileId);
            profile.Update("Ruth Alvarez-Brown", profile.ChapterId, profile.Bio);
            return await db.SaveChangesAsync();
        });
        var people = await SectionOf(holder, e.Id, "People");
        Assert.Equal("Ready", people.GetProperty("state").GetString());
        Assert.Equal(
            [("Ruth Alvarez-Brown", "Speaker", true), ("Abby Brooks", "Judge", false)],
            people.GetProperty("content").GetProperty("people").EnumerateArray().Select(p => (
                p.GetProperty("name").GetString()!, p.GetProperty("role").GetString()!,
                p.GetProperty("profileId").ValueKind == JsonValueKind.String)));
    }

    // L2-161 AC4, L2-157 AC6: a profile of another organisation is not a member to choose.
    [Fact]
    public async Task People_refuse_a_profile_of_another_organisation()
    {
        var (e, holder) = await HubAsync();
        var northside = await factory.AddMemberAsync(await factory.AddOrganisationAsync(), Isolation.Marker());

        var response = await holder.PutAsJsonAsync(Section(e.Id, "People"), new
        {
            people = new[] { new { profileId = northside.ProfileId, role = "Mentor" } },
        });

        Assert.Equal(["Choose a member from the search."], (await ErrorsOf(response))["people[0].profileId"]);
    }

    // L2-162 AC2: the chapter's next public events, excluding this one, members-only, cancelled, past and other chapters.
    [Fact]
    public async Task Upcoming_events_are_the_chapters_next_public_events_limited_by_the_count()
    {
        var city = $"Halifax {Guid.NewGuid():N}"[..20];
        var (e, holder) = await HubAsync("Halifax Builders Night", city);
        var first = await factory.AddEventAsync("Halifax Prayer Night", TimeSpan.FromDays(9), city: city, visibility: EventVisibility.Public);
        var second = await factory.AddEventAsync("Halifax Hack Night", TimeSpan.FromDays(12), city: city, visibility: EventVisibility.Public);
        await factory.AddEventAsync("Halifax Panel", TimeSpan.FromDays(20), city: city, visibility: EventVisibility.Public);
        await factory.AddEventAsync("Halifax Members Night", TimeSpan.FromDays(8), city: city, visibility: EventVisibility.MembersOnly);
        await factory.AddEventAsync("Halifax Cancelled Night", TimeSpan.FromDays(8), city: city, visibility: EventVisibility.Public, cancelledBecause: "Snow.");
        await factory.AddEventAsync("Halifax Past Night", TimeSpan.FromDays(-3), city: city, visibility: EventVisibility.Public);
        await factory.AddEventAsync("Vancouver Night", TimeSpan.FromDays(8), city: "Vancouver", visibility: EventVisibility.Public);

        Assert.Equal(HttpStatusCode.NoContent, (await holder.PutAsJsonAsync(Section(e.Id, "UpcomingEvents"), new { count = 2 })).StatusCode);

        var hub = await holder.GetFromJsonAsync<JsonElement>(Hub(e.Id));
        Assert.Equal([first.Id, second.Id], hub.GetProperty("upcomingEvents").EnumerateArray().Select(x => x.GetProperty("id").GetGuid()));
        Assert.Equal(2, (await SectionOf(holder, e.Id, "UpcomingEvents")).GetProperty("content").GetProperty("count").GetInt32());
    }

    // L2-162 AC2: without a saved count the hub shows three.
    [Fact]
    public async Task Upcoming_events_default_to_three()
    {
        var city = $"Regina {Guid.NewGuid():N}"[..20];
        var (e, holder) = await HubAsync("Regina Builders Night", city);
        for (var i = 1; i <= 4; i++)
        {
            await factory.AddEventAsync($"Regina Night {i}", TimeSpan.FromDays(7 + i), city: city, visibility: EventVisibility.Public);
        }

        var hub = await holder.GetFromJsonAsync<JsonElement>(Hub(e.Id));

        Assert.Equal(["Regina Night 1", "Regina Night 2", "Regina Night 3"],
            hub.GetProperty("upcomingEvents").EnumerateArray().Select(x => x.GetProperty("title").GetString()));
    }

    // L2-156 AC4: the order is every kind exactly once.
    [Fact]
    public async Task Reordering_sets_the_order_and_needs_every_kind_exactly_once()
    {
        var (e, holder) = await HubAsync();
        string[] order = ["Agenda", "Hero", "Venue", "People", "Links", "UpcomingEvents", "Giving"];

        Assert.Equal(HttpStatusCode.NoContent, (await holder.PutAsJsonAsync($"{Hub(e.Id)}/sections/order", new { kinds = order })).StatusCode);
        var missing = await holder.PutAsJsonAsync($"{Hub(e.Id)}/sections/order", new { kinds = order[1..] });
        var twice = await holder.PutAsJsonAsync($"{Hub(e.Id)}/sections/order", new { kinds = order[1..].Append("Hero") });

        var hub = await holder.GetFromJsonAsync<JsonElement>(Hub(e.Id));
        Assert.Equal(order, hub.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("kind").GetString()));
        Assert.Equal(["Choose sections from the list."], (await ErrorsOf(missing))["kinds"]);
        Assert.Equal(["Choose sections from the list."], (await ErrorsOf(twice))["kinds"]);
    }

    // L2-157 AC5: without the capability, saving a section or the order is 403; an administrator overrides, audited.
    [Fact]
    public async Task Without_ManageEventHubs_section_saves_are_403_and_an_administrator_override_is_audited()
    {
        var (e, _) = await HubAsync();
        var other = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);
        var adminMember = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientWithCapabilities(adminMember, Capability.AdministerOrganisation);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutAsJsonAsync(Section(e.Id, "Hero"), new { subtitle = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutAsJsonAsync($"{Hub(e.Id)}/sections/order", new { kinds = Kinds })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync(Section(e.Id, "Hero"), new { subtitle = "A night of building" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync($"{Hub(e.Id)}/sections/order", new { kinds = Kinds })).StatusCode);

        var hubId = await factory.WithDbAsync(db => db.EventHubs.Where(h => h.EventId == e.Id).Select(h => h.Id).SingleAsync());
        var actions = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(a => a.TargetId == hubId.ToString()).Select(a => new { a.Action, a.ActorId }).ToListAsync());
        Assert.Equal(2, actions.Count(a => a.Action == "event_hub.updated" && a.ActorId == adminMember.ProfileId));
    }

    // L2-157 AC6: an unknown kind, an event without a hub and another organisation's event are 404; anonymous is 401.
    [Fact]
    public async Task Unknown_kinds_events_without_a_hub_and_other_organisations_are_404_and_anonymous_is_401()
    {
        var (e, holder) = await HubAsync();
        var bare = await factory.AddEventAsync("No Hub Night", TimeSpan.FromDays(7));
        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        var start = factory.Time.GetUtcNow().AddDays(10);
        var theirs = await (await northside.PostAsync("/api/events", new
        {
            title = Isolation.Marker(), description = "An evening.", type = "builders-night", startsAt = start, endsAt = start.AddHours(2),
            city = "Toronto", format = "InPerson", venue = "Kestrel Labs", onlineLink = (string?)null, capacity = 60, visibility = "Public",
        })).CreatedIdAsync();
        Assert.Equal(HttpStatusCode.Created, (await northside.PostAsync(Hub(theirs), null)).StatusCode);
        var admin = await factory.FaithTechAdminAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await holder.PutAsJsonAsync(Section(e.Id, "Parking"), new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await holder.PutAsJsonAsync(Section(bare.Id, "Hero"), new { subtitle = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync(Section(theirs, "Hero"), new { subtitle = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync($"{Hub(theirs)}/sections/order", new { kinds = Kinds })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().PutAsJsonAsync(Section(e.Id, "Hero"), new { subtitle = "x" })).StatusCode);
    }

    // L2-158 AC4, AC5: Giving reads the organisation's giving link live; FaithTech's seed has one.
    [Fact]
    public async Task Giving_reads_the_organisations_link_and_is_ready_only_when_it_has_one()
    {
        var (e, holder) = await HubAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await holder.PutAsJsonAsync(Section(e.Id, "Giving"), new { line = "Tonight funds the shelters build." })).StatusCode);

        var hub = await holder.GetFromJsonAsync<JsonElement>(Hub(e.Id));
        var organisation = hub.GetProperty("organisation");
        Assert.Equal(("https://faithtech.com/donate", "Help us build the next one."),
            (organisation.GetProperty("givingLink").GetString(), organisation.GetProperty("givingText").GetString()));
        var giving = await SectionOf(holder, e.Id, "Giving");
        Assert.Equal("Ready", giving.GetProperty("state").GetString());
        Assert.Equal("Tonight funds the shelters build.", giving.GetProperty("content").GetProperty("line").GetString());

        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        var start = factory.Time.GetUtcNow().AddDays(10);
        var theirs = await (await northside.PostAsync("/api/events", new
        {
            title = Isolation.Marker(), description = "An evening.", type = "builders-night", startsAt = start, endsAt = start.AddHours(2),
            city = "Toronto", format = "InPerson", venue = "Kestrel Labs", onlineLink = (string?)null, capacity = 60, visibility = "Public",
        })).CreatedIdAsync();
        await northside.PostAsync(Hub(theirs), null);
        Assert.Equal("NeedsInfo", (await SectionOf(northside, theirs, "Giving")).GetProperty("state").GetString());
    }

    // L2-158 AC4: Organisation settings General sets the giving link (https only) and text, audited.
    [Fact]
    public async Task A_settings_manager_sets_the_giving_link_and_text_and_a_plain_http_link_is_400()
    {
        var holder = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageOrganisationSettings);
        var current = await holder.GetFromJsonAsync<JsonElement>("/api/organisation");
        var name = current.GetProperty("name").GetString();
        var shortName = current.GetProperty("shortName").GetString();

        var refused = await holder.PutAsJsonAsync("/api/organisation", new { name, shortName, givingLink = "http://faithtech.com/donate" });
        var saved = await holder.PutAsJsonAsync("/api/organisation", new
        {
            name, shortName, givingLink = "https://faithtech.com/give", givingText = "Give to the next build.",
        });

        Assert.Equal(["Use a link that starts with https://"], (await ErrorsOf(refused))["givingLink"]);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var after = await holder.GetFromJsonAsync<JsonElement>("/api/organisation");
        Assert.Equal(("https://faithtech.com/give", "Give to the next build."),
            (after.GetProperty("givingLink").GetString(), after.GetProperty("givingText").GetString()));
        Assert.True(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(a =>
            a.Action == "organisation.updated" && a.AfterJson!.Contains("https://faithtech.com/give"))));

        // Left out keeps the values, as the settings dialog sends them only when they change; empty clears them.
        (await holder.PutAsJsonAsync("/api/organisation", new { name, shortName })).EnsureSuccessStatusCode();
        var kept = await holder.GetFromJsonAsync<JsonElement>("/api/organisation");
        Assert.Equal("https://faithtech.com/give", kept.GetProperty("givingLink").GetString());
        (await holder.PutAsJsonAsync("/api/organisation", new { name, shortName, givingLink = "", givingText = "" })).EnsureSuccessStatusCode();
        var cleared = await holder.GetFromJsonAsync<JsonElement>("/api/organisation");
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("givingLink").ValueKind);

        // Put FaithTech's seeded values back for the other tests sharing this fixture.
        (await holder.PutAsJsonAsync("/api/organisation", new
        {
            name, shortName, givingLink = "https://faithtech.com/donate", givingText = "Help us build the next one.",
        })).EnsureSuccessStatusCode();
    }
}
