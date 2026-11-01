// Traces to: L2-166 AC1 to AC6, L2-167 AC2, AC3
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

// The page read (ADR 0040): every combination of public or members-only event, Draft or Published hub, and anonymous,
// member or manager caller. Every refusal is 404.
public class EventHubPageTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);

    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static string Page(Guid eventId) => $"{Hub(eventId)}/page";

    private async Task<HttpClient> ManagerAsync() =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageEventHubs);

    private async Task<HttpClient> MemberAsync() => factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"));

    /// <summary>An event a week away with a hub; published unless asked otherwise.</summary>
    private async Task<(Guid EventId, HttpClient Manager)> HubAsync(EventVisibility visibility, bool publish = true)
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Week, visibility: visibility);
        var manager = await ManagerAsync();
        Assert.Equal(HttpStatusCode.Created, (await manager.PostAsync(Hub(e.Id), null)).StatusCode);
        if (publish)
        {
            Assert.Equal(HttpStatusCode.NoContent, (await manager.PostAsync($"{Hub(e.Id)}/publish", null)).StatusCode);
        }

        return (e.Id, manager);
    }

    private static string[] Kinds(JsonElement page) =>
        [.. page.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("kind").GetString()!)];

    // L2-166 AC1, AC4: anyone reads a published hub of a public event, and only its shown sections.
    [Fact]
    public async Task An_anonymous_visitor_reads_a_published_hub_of_a_public_event_with_only_its_shown_sections()
    {
        var (eventId, manager) = await HubAsync(EventVisibility.Public);
        Assert.Equal(HttpStatusCode.NoContent, (await manager.PutAsJsonAsync(Hub(eventId), new
        {
            templateKey = "blank",
            sections = new[] { new { kind = "Venue", visible = false } },
        })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await manager.PutAsJsonAsync($"{Hub(eventId)}/sections/Hero", new { subtitle = "A night of building" })).StatusCode);
        var manage = await manager.GetFromJsonAsync<JsonElement>(Hub(eventId));
        var expected = manage.GetProperty("sections").EnumerateArray()
            .Where(s => s.GetProperty("visible").GetBoolean() && s.GetProperty("state").GetString() == "Ready"
                && (s.GetProperty("kind").GetString() != "UpcomingEvents" || manage.GetProperty("upcomingEvents").GetArrayLength() > 0))
            .Select(s => s.GetProperty("kind").GetString()!).ToArray();

        var response = await factory.CreateClient().GetAsync(Page(eventId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(page.GetProperty("canManage").GetBoolean());
        Assert.Equal("Published", page.GetProperty("status").GetString());
        Assert.Equal("Toronto Builders Night", page.GetProperty("event").GetProperty("title").GetString());
        Assert.Equal(expected, Kinds(page));
        Assert.Contains("Hero", Kinds(page));
        Assert.DoesNotContain("Venue", Kinds(page));
        Assert.DoesNotContain("Agenda", Kinds(page));
        Assert.Equal("A night of building",
            page.GetProperty("sections")[0].GetProperty("content").GetProperty("subtitle").GetString());
    }

    // L2-166 AC4: Upcoming events is answered only when the chapter has upcoming events.
    [Fact]
    public async Task Upcoming_events_is_answered_only_when_there_are_upcoming_events()
    {
        var e = await factory.AddEventAsync("Halifax Builders Night", Week, city: "Halifax", visibility: EventVisibility.Public);
        var manager = await ManagerAsync();
        await manager.PostAsync(Hub(e.Id), null);
        await manager.PostAsync($"{Hub(e.Id)}/publish", null);
        var anonymous = factory.CreateClient();

        Assert.DoesNotContain("UpcomingEvents", Kinds(await anonymous.GetFromJsonAsync<JsonElement>(Page(e.Id))));

        await factory.AddEventAsync("Halifax Prayer Breakfast", Week * 2, city: "Halifax", visibility: EventVisibility.Public);

        Assert.Contains("UpcomingEvents", Kinds(await anonymous.GetFromJsonAsync<JsonElement>(Page(e.Id))));
    }

    // L2-166 AC2, AC3: anonymous visitors get 404 for a draft hub, a members-only event, an event without a hub and an unknown event.
    [Fact]
    public async Task An_anonymous_visitor_gets_404_for_a_draft_hub_a_members_only_hub_no_hub_and_an_unknown_event()
    {
        var (draft, _) = await HubAsync(EventVisibility.Public, publish: false);
        var (membersOnly, _) = await HubAsync(EventVisibility.MembersOnly);
        var noHub = await factory.AddEventAsync("Prayer Breakfast", Week, visibility: EventVisibility.Public);
        var anonymous = factory.CreateClient();

        foreach (var id in new[] { draft, membersOnly, noHub.Id, Guid.NewGuid() })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync(Page(id))).StatusCode);
        }
    }

    // L2-166 AC2, AC3: a member reads published hubs, also on members-only events, but never a draft, and is never refused with 403.
    [Fact]
    public async Task A_member_reads_published_hubs_of_members_only_and_public_events_but_not_a_draft()
    {
        var (membersOnly, _) = await HubAsync(EventVisibility.MembersOnly);
        var (publicHub, _) = await HubAsync(EventVisibility.Public);
        var (draft, _) = await HubAsync(EventVisibility.MembersOnly, publish: false);
        var member = await MemberAsync();

        Assert.Equal(HttpStatusCode.OK, (await member.GetAsync(Page(membersOnly))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await member.GetAsync(Page(publicHub))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync(Page(draft))).StatusCode);
        Assert.False((await member.GetFromJsonAsync<JsonElement>(Page(membersOnly))).GetProperty("canManage").GetBoolean());
    }

    // L2-166 AC3: a holder of ManageEventHubs reads a draft hub as the preview.
    [Fact]
    public async Task A_hub_manager_reads_a_draft_hub_as_the_preview()
    {
        var (draft, manager) = await HubAsync(EventVisibility.MembersOnly, publish: false);

        var page = await manager.GetFromJsonAsync<JsonElement>(Page(draft));

        Assert.True(page.GetProperty("canManage").GetBoolean());
        Assert.Equal("Draft", page.GetProperty("status").GetString());
    }

    // L2-166 AC3: another organisation's published public hub is 404 on this host, to anyone.
    [Fact]
    public async Task Another_organisations_published_hub_is_404()
    {
        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        var start = factory.Time.GetUtcNow().AddDays(10);
        var theirs = await (await northside.PostAsync("/api/events", new
        {
            title = Isolation.Marker(), description = "An evening.", type = "builders-night", startsAt = start, endsAt = start.AddHours(2),
            city = "Toronto", format = "InPerson", venue = "Kestrel Labs", onlineLink = (string?)null, capacity = 60, visibility = "Public",
        })).CreatedIdAsync();
        Assert.Equal(HttpStatusCode.Created, (await northside.PostAsync(Hub(theirs), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await northside.PostAsync($"{Hub(theirs)}/publish", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await northside.GetAsync(Page(theirs))).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync(Page(theirs))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await (await MemberAsync()).GetAsync(Page(theirs))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await (await factory.FaithTechAdminAsync()).GetAsync(Page(theirs))).StatusCode);
    }

    // L2-166 AC5: anonymous visitors get people without profile ids; members get them.
    [Fact]
    public async Task Anonymous_visitors_get_people_without_profile_ids_and_members_get_them()
    {
        var (eventId, manager) = await HubAsync(EventVisibility.Public);
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        Assert.Equal(HttpStatusCode.NoContent, (await manager.PutAsJsonAsync($"{Hub(eventId)}/sections/People", new
        {
            people = new object[]
            {
                new { profileId = ruth.ProfileId, role = "Speaker" },
                new { profileId = (Guid?)null, name = "Abby Brooks", line = "Founder, Kestrel Labs", role = "Judge" },
            },
        })).StatusCode);

        static JsonElement People(JsonElement page) => page.GetProperty("sections").EnumerateArray()
            .Single(s => s.GetProperty("kind").GetString() == "People").GetProperty("content").GetProperty("people");

        var anonymous = People(await factory.CreateClient().GetFromJsonAsync<JsonElement>(Page(eventId)));
        Assert.Equal(["Ruth Alvarez", "Abby Brooks"], anonymous.EnumerateArray().Select(p => p.GetProperty("name").GetString()));
        Assert.All(anonymous.EnumerateArray(), p => Assert.Equal(JsonValueKind.Null, p.GetProperty("profileId").ValueKind));

        var member = People(await (await MemberAsync()).GetFromJsonAsync<JsonElement>(Page(eventId)));
        Assert.Equal(ruth.ProfileId, member[0].GetProperty("profileId").GetGuid());
    }

    // L2-166 AC6: a change to the event shows on the hub at the next read.
    [Fact]
    public async Task A_change_to_the_event_shows_on_the_hub_at_the_next_read()
    {
        var (eventId, _) = await HubAsync(EventVisibility.Public);
        var later = factory.Time.GetUtcNow().AddDays(8);
        await factory.WithDbAsync(async db =>
        {
            var e = await db.Events.Include(x => x.Type).SingleAsync(x => x.Id == eventId);
            e.Update("Toronto Builders Night: Winter", e.Description, e.Type!, later, later.AddHours(3), e.ChapterId, e.Format,
                "Centre for Social Innovation", e.OnlineLink, e.Capacity, e.Visibility);
            return await db.SaveChangesAsync();
        });

        var facts = (await factory.CreateClient().GetFromJsonAsync<JsonElement>(Page(eventId))).GetProperty("event");

        Assert.Equal("Toronto Builders Night: Winter", facts.GetProperty("title").GetString());
        Assert.Equal(later, facts.GetProperty("startsAt").GetDateTimeOffset());
        Assert.Equal("Centre for Social Innovation", facts.GetProperty("venue").GetString());
    }

    // L2-167 AC2, AC3: the public event and the event detail link to a published hub only.
    [Fact]
    public async Task The_public_event_and_the_event_detail_link_to_the_hub_only_once_it_is_published()
    {
        var (eventId, manager) = await HubAsync(EventVisibility.Public, publish: false);
        var member = await MemberAsync();

        Assert.Equal(JsonValueKind.Null,
            (await factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/public/events/{eventId}")).GetProperty("hubLink").ValueKind);
        Assert.Equal(JsonValueKind.Null,
            (await member.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}")).GetProperty("hubLink").ValueKind);

        await manager.PostAsync($"{Hub(eventId)}/publish", null);

        Assert.EndsWith($"/public/events/{eventId}/hub",
            (await factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/public/events/{eventId}")).GetProperty("hubLink").GetString());
        Assert.EndsWith($"/public/events/{eventId}/hub",
            (await member.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}")).GetProperty("hubLink").GetString());
    }

    // L2-166, L2-151: FaithTech's Staff read a published members-only hub as members; an anonymous visitor cannot.
    [Fact]
    public async Task FaithTech_staff_read_a_published_members_only_hub_and_anonymous_visitors_cannot()
    {
        var (eventId, _) = await HubAsync(EventVisibility.MembersOnly);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), Role.Staff);

        Assert.Equal(HttpStatusCode.OK, (await staff.GetAsync(Page(eventId))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync(Page(eventId))).StatusCode);
    }
}
