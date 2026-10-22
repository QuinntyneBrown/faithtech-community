// Traces to: L2-117, L2-118, L2-119, L2-121 (docs/detailed-designs/events/event-check-in)
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

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

    // L2-118 AC1: Given an event with RSVPs, when the check-in page loads, then it lists every member and guest
    // who RSVP'd, in RSVP order, with the event's title, date, and counts of going and checked in.
    // L2-117 AC6: it carries whether the caller can edit, and guest emails only for callers who may see them.
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

    // L2-117 AC2: Given Staff, when they open the check-in page, then they see the attendees and counts
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

    // L2-117 AC3: Given a signed-in member without a lead role, Staff or System Admin, when they open the check-in
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

    // L2-117 AC4: Given an anonymous visitor, when they call a check-in endpoint, then the response is 401.
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

    // L2-119 AC1: Given a lead, when they turn on an attendee's switch, then PUT saves the check-in at once with
    // the time and who checked them in, and the checked-in count rises.
    // L2-119 AC4: Given an attendee already checked in, when the check-in is saved again, then the original time is kept.
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

    // L2-119 AC2: Given a checked-in attendee, when the lead turns the switch off or chooses Undo, then DELETE
    // clears the check-in, the time is removed and the count falls.
    // L2-121 AC5: Given another lead checks someone in, when this lead reloads the page, then the check-in is shown.
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

    // L2-117 AC5: Given a System Admin without a lead role, when they check in or undo, then each write is
    // recorded in the audit log.
    [Fact]
    public async Task A_System_Admin_without_a_lead_role_is_audited_and_a_lead_is_not()
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var priya = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientFor(priya, Role.SystemAdmin);
        var rsvpId = await RsvpIdAsync(admin, eventId, "Abby Brooks");

        await admin.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null);
        await admin.DeleteAsync($"/api/events/{eventId}/check-ins/{rsvpId}");
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var both = factory.ClientFor(esther, Role.SystemAdmin, Role.CityLead);
        await both.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null);

        var entries = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking()
            .Where(a => a.TargetId == eventId.ToString()).ToListAsync());
        Assert.Equal(["event.check_in_undone", "event.checked_in"], entries.Select(a => a.Action).Order());
        Assert.All(entries, a => Assert.Equal(("Event", priya.ProfileId), (a.TargetType, a.ActorId)));
        var checkedIn = entries.Single(a => a.Action == "event.checked_in");
        Assert.Contains("Abby Brooks", checkedIn.AfterJson);
        Assert.Contains(rsvpId.ToString(), checkedIn.AfterJson);
    }

    // L2-119 AC5: Given a cancelled event, when a lead opens its check-in page, then it says the event is
    // cancelled, and any check-in write answers 409.
    [Fact]
    public async Task A_cancelled_event_shows_cancelled_and_refuses_check_in_writes_with_409()
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(lead, Role.EventLead);
        var rsvpId = await RsvpIdAsync(client, eventId, "Abby Brooks");
        await client.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null);
        await factory.CancelEventAsync(eventId, "The venue flooded.");

        var page = await client.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}/check-in");
        var put = await client.PutAsync($"/api/events/{eventId}/check-ins/{rsvpId}", null);
        var delete = await client.DeleteAsync($"/api/events/{eventId}/check-ins/{rsvpId}");

        Assert.Equal((true, false, "The venue flooded."), (page.GetProperty("isCancelled").GetBoolean(),
            page.GetProperty("isOpen").GetBoolean(), page.GetProperty("cancellationReason").GetString()));
        foreach (var response in new[] { put, delete })
        {
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("This event was cancelled.", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
        }

        Assert.NotNull((await factory.LoadEventAsync(eventId)).Rsvps.Single(r => r.Id == rsvpId).CheckedInAt);
    }

    // L2-119 AC6: Given an event that starts more than 24 hours from now, when a lead tries to check someone in,
    // then the response is 409 and the page says when check-in opens.
    [Fact]
    public async Task Check_in_opens_24_hours_before_the_start()
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", TimeSpan.FromHours(25), guests: [("Abby Brooks", "abby@example.org")]);
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(lead, Role.EventLead);
        var page = await client.GetFromJsonAsync<JsonElement>($"/api/events/{e.Id}/check-in");
        var rsvpId = page.GetProperty("attendees")[0].GetProperty("rsvpId").GetGuid();

        var response = await client.PutAsync($"/api/events/{e.Id}/check-ins/{rsvpId}", null);

        Assert.False(page.GetProperty("isOpen").GetBoolean());
        Assert.Equal(e.StartsAt.AddHours(-24), page.GetProperty("checkInOpensAt").GetDateTimeOffset());
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Check-in hasn’t opened yet.", problem.GetProperty("detail").GetString());
        Assert.Equal(e.StartsAt.AddHours(-24), problem.GetProperty("opensAt").GetDateTimeOffset());
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/events/{e.Id}/check-ins/{rsvpId}")).StatusCode);

        factory.Time.Advance(TimeSpan.FromHours(1));
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsync($"/api/events/{e.Id}/check-ins/{rsvpId}", null)).StatusCode);
    }

    // L2-121 AC1: Given an event with at least one check-in, when a lead, Staff or System Admin opens the event page,
    // then the check-in count is shown; L2-121 AC2: members get no count. L2-117 AC1: leads are offered Check in.
    [Theory]
    [InlineData(Role.EventLead, 1, true, true)]
    [InlineData(Role.SystemAdmin, 1, true, true)]
    [InlineData(Role.Staff, 1, false, true)]
    [InlineData(Role.Attendee, null, false, false)]
    public async Task The_event_page_carries_the_check_in_count_and_what_the_caller_may_do(
        Role role, int? count, bool canCheckIn, bool canViewCheckIn)
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var lead = factory.ClientFor(grace, Role.EventLead);
        await lead.PutAsync($"/api/events/{eventId}/check-ins/{await RsvpIdAsync(lead, eventId, "Ruth Alvarez")}", null);
        var viewer = await factory.AddMemberAsync("Leah Thompson");

        var json = await factory.ClientFor(viewer, role).GetFromJsonAsync<JsonElement>($"/api/events/{eventId}");

        var checkedIn = json.GetProperty("checkedInCount");
        Assert.Equal(count, checkedIn.ValueKind == JsonValueKind.Null ? null : checkedIn.GetInt32());
        Assert.Equal((canCheckIn, canViewCheckIn), (json.GetProperty("canCheckIn").GetBoolean(), json.GetProperty("canViewCheckIn").GetBoolean()));
    }

    // docs/mocks/pages/event/attendance: the RSVP list on the event page says when each attendee checked in.
    [Fact]
    public async Task The_event_pages_rsvp_list_carries_each_check_in_time()
    {
        var (eventId, _, _) = await EventWithRsvpsAsync();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var lead = factory.ClientFor(grace, Role.EventLead);
        await lead.PutAsync($"/api/events/{eventId}/check-ins/{await RsvpIdAsync(lead, eventId, "Ruth Alvarez")}", null);

        var rsvps = (await lead.GetFromJsonAsync<JsonElement>($"/api/events/{eventId}")).GetProperty("rsvps").EnumerateArray().ToList();

        Assert.Equal(factory.Time.GetUtcNow(), rsvps.Single(r => r.GetProperty("name").GetString() == "Ruth Alvarez").GetProperty("checkedInAt").GetDateTimeOffset());
        Assert.Equal(JsonValueKind.Null, rsvps.Single(r => r.GetProperty("name").GetString() == "Jonah Bell").GetProperty("checkedInAt").ValueKind);
    }
}
