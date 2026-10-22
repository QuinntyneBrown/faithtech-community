// Traces to: L2-092, L2-093, L2-094 (docs/detailed-designs/events/event-check-in)
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Api.Tests.Events;

public class CheckInTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    // Check-in opens 24 hours before the start, so these events start soon.
    private static readonly TimeSpan Soon = TimeSpan.FromHours(2);

    private async Task<(Guid EventId, ProfileClients.Member Ruth, ProfileClients.Member Jonah)> EventWithRsvpsAsync()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon,
            members: [ruth.ProfileId, jonah.ProfileId], guests: [("Abby Brooks", "abby@example.org")]);
        return (e.Id, ruth, jonah);
    }

    private static async Task<Guid> RsvpIdAsync(HttpClient client, Guid eventId, string name) =>
        (await client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}/check-in"))
            .GetProperty("attendees").EnumerateArray()
            .Single(a => a.GetProperty("name").GetString() == name).GetProperty("rsvpId").GetGuid();

    // L2-093 AC1: Given an event with RSVPs, when the check-in page loads, then it lists every member and guest
    // who RSVP'd, in RSVP order, with the event's title, date, and counts of going and checked in.
    // L2-092 AC6: it carries whether the caller can edit, and guest emails only for callers who may see them.
    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Leads_and_System_Admins_get_the_attendees_in_rsvp_order_with_guest_emails(Role role)
    {
        var (eventId, ruth, _) = await EventWithRsvpsAsync();
        var lead = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(lead, role).GetAsync($"/api/events/{eventId}/check-in");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(("Toronto Builders Night", true, true), (json.GetProperty("title").GetString(),
            json.GetProperty("canEdit").GetBoolean(), json.GetProperty("isOpen").GetBoolean()));
        Assert.Equal((3, 0, 0), (json.GetProperty("going").GetInt32(), json.GetProperty("checkedIn").GetInt32(),
            json.GetProperty("walkIns").GetInt32()));
        var attendees = json.GetProperty("attendees").EnumerateArray().ToList();
        Assert.Equal(["Ruth Alvarez", "Jonah Bell", "Abby Brooks"], attendees.Select(a => a.GetProperty("name").GetString()));
        Assert.Equal((ruth.ProfileId, false, false), (attendees[0].GetProperty("profileId").GetGuid(),
            attendees[0].GetProperty("isGuest").GetBoolean(), attendees[0].GetProperty("isWalkIn").GetBoolean()));
        Assert.Equal(JsonValueKind.Null, attendees[0].GetProperty("email").ValueKind);
        Assert.Equal(("abby@example.org", true), (attendees[2].GetProperty("email").GetString(), attendees[2].GetProperty("isGuest").GetBoolean()));
        Assert.All(attendees, a => Assert.Equal(JsonValueKind.Null, a.GetProperty("checkedInAt").ValueKind));
    }

    // L2-092 AC2: Given Staff, when they open the check-in page, then they see the attendees and counts
    // read-only, without guest emails, and every check-in write answers 403.
    [Fact]
    public async Task Staff_see_the_attendees_read_only_without_guest_emails()
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var sam = await factory.AddMemberAsync("Sam Rivera");
        var client = factory.ClientFor(sam, Role.Staff);

        var json = await client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}/check-in");

        Assert.False(json.GetProperty("canEdit").GetBoolean());
        Assert.False(json.GetProperty("canExport").GetBoolean());
        Assert.Equal(3, json.GetProperty("attendees").GetArrayLength());
        Assert.DoesNotContain("abby@example.org", json.GetRawText());
        var rsvpId = json.GetProperty("attendees")[0].GetProperty("rsvpId").GetGuid();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync($"/api/events/{eventId}/check-ins/{rsvpId}")).StatusCode);
    }

    // L2-092 AC3: Given a signed-in member without a lead role, Staff or System Admin, when they open the check-in
    // page or call a check-in endpoint, then the response is 403.
    [Theory]
    [InlineData]
    [InlineData(Role.Attendee, Role.Volunteer, Role.ProductEngineer)]
    public async Task Other_members_get_403(params Role[] roles)
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var rsvpId = await RsvpIdAsync(factory.ClientFor(lead, Role.EventLead), eventId, "Abby Brooks");
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var client = factory.ClientFor(leah, roles);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/events/{eventId}/check-in")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync($"/api/events/{eventId}/check-ins/{rsvpId}")).StatusCode);
    }

    // L2-092 AC4: Given an anonymous visitor, when they call a check-in endpoint, then the response is 401.
    [Fact]
    public async Task Anonymous_visitors_get_401()
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var anonymous = factory.CreateClient();
        var rsvpId = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/events/{eventId}/check-in")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync($"/api/events/{eventId}/check-ins/{rsvpId}")).StatusCode);
    }

    [Fact]
    public async Task An_unknown_event_or_an_rsvp_on_another_event_is_404()
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var other = await factory.AddEventAsync("Panel", Soon, guests: [("Ben Carter", "ben@example.org")]);
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(lead, Role.EventLead);
        var elsewhere = await RsvpIdAsync(client, other.Id, "Ben Carter");

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/events/{Guid.NewGuid()}/check-in")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsync($"/api/events/{eventId}/check-ins/{elsewhere}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/events/{eventId}/check-ins/{elsewhere}")).StatusCode);
    }

    // L2-094 AC1: Given a lead, when they turn on an attendee's switch, then PUT saves the check-in at once with
    // the time and who checked them in, and the checked-in count rises.
    // L2-094 AC4: Given an attendee already checked in, when the check-in is saved again, then the original time is kept.
    [Fact]
    public async Task A_lead_checks_an_attendee_in_and_saving_again_keeps_the_first_time()
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(lead, Role.CreateLead);
        var rsvpId = await RsvpIdAsync(client, eventId, "Abby Brooks");
        var at = factory.Time.GetUtcNow();

        var response = await client.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var attendee = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(("Abby Brooks", at), (attendee.GetProperty("name").GetString(), attendee.GetProperty("checkedInAt").GetDateTimeOffset()));
        var saved = (await factory.LoadEventAsync(eventId)).Rsvps.Single(r => r.Id == rsvpId);
        Assert.Equal(((DateTimeOffset?)at, (Guid?)lead.ProfileId), (saved.CheckedInAt, saved.CheckedInById));
        var page = await client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}/check-in");
        Assert.Equal(1, page.GetProperty("checkedIn").GetInt32());

        factory.Time.Advance(TimeSpan.FromMinutes(5));
        var again = await client.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null);

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(at, (await again.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("checkedInAt").GetDateTimeOffset());
    }

    // L2-094 AC2: Given a checked-in attendee, when the lead turns the switch off or chooses Undo, then DELETE
    // clears the check-in, the time is removed and the count falls.
    // L2-096 AC5: Given another lead checks someone in, when this lead reloads the page, then the check-in is shown.
    [Fact]
    public async Task Another_lead_sees_the_check_in_and_undoing_clears_it()
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var first = factory.ClientFor(grace, Role.EventLead);
        var second = factory.ClientFor(marcus, Role.CityLead);
        var rsvpId = await RsvpIdAsync(first, eventId, "Ruth Alvarez");
        await first.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null);

        var seen = await second.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}/check-in");
        Assert.Equal(1, seen.GetProperty("checkedIn").GetInt32());
        Assert.NotEqual(JsonValueKind.Null, seen.GetProperty("attendees")[0].GetProperty("checkedInAt").ValueKind);

        var undo = await second.DeleteAsync($"/api/events/{eventId}/check-ins/{rsvpId}");

        Assert.Equal(HttpStatusCode.NoContent, undo.StatusCode);
        var saved = (await factory.LoadEventAsync(eventId)).Rsvps.Single(r => r.Id == rsvpId);
        Assert.Equal((null, null), (saved.CheckedInAt, saved.CheckedInById));
        Assert.Equal(0, (await first.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}/check-in")).GetProperty("checkedIn").GetInt32());
    }
}
