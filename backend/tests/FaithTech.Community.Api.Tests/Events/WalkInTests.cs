// Traces to: L2-095, L2-092 AC5, L2-094 AC6, L2-096 AC3 (docs/detailed-designs/events/event-check-in)
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

public class WalkInTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Soon = TimeSpan.FromHours(2);

    private async Task<HttpClient> LeadAsync(Role role = Role.EventLead) =>
        factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), role);

    private static Task<HttpResponseMessage> AddWalkInAsync(HttpClient client, Guid eventId, object body) =>
        client.PostAsJsonAsync($"/api/events/{eventId}/walk-ins", body);

    // L2-095 AC2: Given a name, when the lead saves, then the walk-in is added to the end of the list marked as a
    // walk-in, checked in with the time when "Check them in now" is on (the default).
    // L2-095 AC7: no RSVP confirmation email is sent.
    [Fact]
    public async Task A_lead_adds_a_walk_in_who_is_checked_in_at_the_end_of_the_list()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon, members: [ruth.ProfileId]);
        var client = await LeadAsync();

        var response = await AddWalkInAsync(client, e.Id, new { name = "  Mira Chen ", email = "mira.chen@example.org" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(result.GetProperty("reused").GetBoolean());
        var attendee = result.GetProperty("attendee");
        Assert.Equal(("Mira Chen", true, true, "mira.chen@example.org"), (attendee.GetProperty("name").GetString(),
            attendee.GetProperty("isWalkIn").GetBoolean(), attendee.GetProperty("isGuest").GetBoolean(), attendee.GetProperty("email").GetString()));
        Assert.Equal(factory.Time.GetUtcNow(), attendee.GetProperty("checkedInAt").GetDateTimeOffset());
        var page = await client.GetFromJsonAsync<JsonElement>($"/api/events/{e.Id}/check-in");
        Assert.Equal(["Ruth Alvarez", "Mira Chen"], page.GetProperty("attendees").EnumerateArray().Select(a => a.GetProperty("name").GetString()));
        Assert.Equal((2, 1, 1), (page.GetProperty("going").GetInt32(), page.GetProperty("checkedIn").GetInt32(), page.GetProperty("walkIns").GetInt32()));
        Assert.Empty(await factory.QueuedEmailsToAsync("mira.chen@example.org"));
    }

    [Fact]
    public async Task A_walk_in_added_with_check_them_in_now_off_is_not_here_yet()
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon);

        var response = await AddWalkInAsync(await LeadAsync(Role.CommunicationsLead), e.Id, new { name = "Mira Chen", checkInNow = false });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var attendee = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("attendee");
        Assert.Equal(JsonValueKind.Null, attendee.GetProperty("checkedInAt").ValueKind);
        Assert.Equal(JsonValueKind.Null, attendee.GetProperty("email").ValueKind);
    }

    // L2-095 AC4: Given an email that belongs to a verified member's account, when the walk-in is saved, then the
    // row is linked to that member's profile and shows as a member, not a guest.
    [Fact]
    public async Task A_verified_members_email_links_the_walk_in_to_their_profile()
    {
        var mira = await factory.AddMemberAsync("Mira Chen");
        var address = await factory.EmailOfAsync(mira);
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon);

        var response = await AddWalkInAsync(await LeadAsync(), e.Id, new { name = "Mira", email = address.ToUpperInvariant() });

        var attendee = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("attendee");
        Assert.Equal((mira.ProfileId, false, "Mira Chen"), (attendee.GetProperty("profileId").GetGuid(),
            attendee.GetProperty("isGuest").GetBoolean(), attendee.GetProperty("name").GetString()));
        Assert.Equal(JsonValueKind.Null, attendee.GetProperty("email").ValueKind);
        var saved = Assert.Single((await factory.LoadEventAsync(e.Id)).Rsvps);
        Assert.Equal(((Guid?)mira.ProfileId, true, (string?)null), (saved.ProfileId, saved.IsWalkIn, saved.GuestEmail));
    }

    [Fact]
    public async Task An_unverified_accounts_email_stays_a_guest_walk_in()
    {
        var mira = await factory.AddMemberAsync("Mira Chen");
        var address = await factory.EmailOfAsync(mira);
        await factory.WithDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Id == mira.UserId)).EmailConfirmed = false;
            return await db.SaveChangesAsync();
        });
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon);

        var response = await AddWalkInAsync(await LeadAsync(), e.Id, new { name = "Mira", email = address });

        var attendee = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("attendee");
        Assert.True(attendee.GetProperty("isGuest").GetBoolean());
        Assert.Equal("Mira", attendee.GetProperty("name").GetString());
    }

    // L2-095 AC5: Given the member or email already has an RSVP for the event, when the walk-in is saved, then
    // that RSVP is reused, and checked in when "Check them in now" is on, rather than a second row being created.
    [Fact]
    public async Task An_existing_rsvp_is_reused_and_checked_in()
    {
        var mira = await factory.AddMemberAsync("Mira Chen");
        var address = await factory.EmailOfAsync(mira);
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon,
            members: [mira.ProfileId], guests: [("Abby Brooks", "abby@example.org")]);
        var client = await LeadAsync();

        var byMember = await AddWalkInAsync(client, e.Id, new { name = "Mira", email = address });
        var byGuest = await AddWalkInAsync(client, e.Id, new { name = "Abby", email = "ABBY@example.org" });

        Assert.Equal(HttpStatusCode.OK, byMember.StatusCode);
        Assert.Equal(HttpStatusCode.OK, byGuest.StatusCode);
        var guest = await byGuest.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(guest.GetProperty("reused").GetBoolean());
        Assert.Equal(("Abby Brooks", false), (guest.GetProperty("attendee").GetProperty("name").GetString(),
            guest.GetProperty("attendee").GetProperty("isWalkIn").GetBoolean()));
        var saved = await factory.LoadEventAsync(e.Id);
        Assert.Equal(2, saved.Rsvps.Count);
        Assert.All(saved.Rsvps, r => Assert.Equal((false, true), (r.IsWalkIn, r.IsCheckedIn)));
    }

    // L2-095 AC6: Given an event at capacity or one that has started, when a walk-in is added, then it is still added.
    // L2-096 AC3: the event list, the event page and the public page are unchanged by walk-ins.
    [Fact]
    public async Task Walk_ins_skip_capacity_and_the_start_and_leave_rsvp_counts_alone()
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", -TimeSpan.FromMinutes(30), capacity: 1, rsvps: 1,
            visibility: EventVisibility.Public);
        var client = await LeadAsync(Role.CityLead);

        var response = await AddWalkInAsync(client, e.Id, new { name = "Mira Chen" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var detail = await client.GetFromJsonAsync<JsonElement>($"/api/events/{e.Id}");
        Assert.Equal((1, true, 1), (detail.GetProperty("rsvpCount").GetInt32(), detail.GetProperty("isFull").GetBoolean(),
            detail.GetProperty("rsvps").GetArrayLength()));
        var listed = (await client.GetFromJsonAsync<JsonElement>("/api/events")).GetProperty("events").EnumerateArray()
            .Single(x => x.GetProperty("id").GetGuid() == e.Id);
        Assert.Equal(1, listed.GetProperty("rsvpCount").GetInt32());
        var publicPage = await factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/public/events/{e.Id}");
        Assert.Equal(1, publicPage.GetProperty("rsvpCount").GetInt32());
        var csv = await (await client.GetAsync($"/api/events/{e.Id}/rsvps.csv")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("Mira Chen", csv);
    }

    // L2-095 AC3: Given no name, a name over 100 characters after trimming, or an invalid email, when the lead
    // saves, then the field shows an inline error and nothing is saved.
    [Theory]
    [InlineData(" ", null, "Name", "Enter their name so the list shows who came.")]
    [InlineData(null, null, "Name", "Enter their name so the list shows who came.")]
    [InlineData("x", "mira.chen@", "Email", "Enter an email like name@example.com, or leave it empty.")]
    public async Task A_walk_in_needs_a_name_and_a_valid_email_if_any(string? name, string? email, string field, string message)
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon);

        var response = await AddWalkInAsync(await LeadAsync(), e.Id, new { name, email });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal(message, errors.GetProperty(field)[0].GetString());
        Assert.Empty((await factory.LoadEventAsync(e.Id)).Rsvps);
    }

    [Fact]
    public async Task A_name_over_100_characters_is_refused()
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon);

        var response = await AddWalkInAsync(await LeadAsync(), e.Id, new { name = $" {new string('a', 101)} " });

        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal("Use 100 characters or fewer for the name.", errors.GetProperty("Name")[0].GetString());
    }

    // L2-095 AC8: Given Staff, when a walk-in is submitted, then the response is 403; other members get 403 too.
    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.Attendee)]
    public async Task Staff_and_members_cannot_add_walk_ins(Role role)
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon);

        var response = await AddWalkInAsync(await LeadAsync(role), e.Id, new { name = "Mira Chen" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty((await factory.LoadEventAsync(e.Id)).Rsvps);
    }

    [Fact]
    public async Task Anonymous_visitors_get_401_and_an_unknown_event_is_404()
    {
        var anonymous = await AddWalkInAsync(factory.CreateClient(), Guid.NewGuid(), new { name = "Mira Chen" });
        var unknown = await AddWalkInAsync(await LeadAsync(), Guid.NewGuid(), new { name = "Mira Chen" });

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task An_event_with_a_walk_in_who_gave_no_email_can_still_be_cancelled()
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon, guests: [("Abby Brooks", "abby@example.org")]);
        var lead = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(lead, Role.EventLead);
        await AddWalkInAsync(client, e.Id, new { name = "Mira Chen" });

        var response = await client.PostAsJsonAsync($"/api/events/{e.Id}/cancel", new { reason = "The venue flooded." });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Single(await factory.QueuedEmailsToAsync("abby@example.org"));
    }

    // L2-095 AC8: Given a cancelled event, when a walk-in is submitted, then the response is 409.
    // L2-094 AC6: walk-ins keep to the same 24-hour window as check-ins.
    [Fact]
    public async Task A_cancelled_or_not_yet_open_event_refuses_walk_ins_with_409()
    {
        var cancelled = await factory.AddEventAsync("Panel", Soon, cancelledBecause: "The venue flooded.");
        var early = await factory.AddEventAsync("Hackathon", TimeSpan.FromDays(3));
        var client = await LeadAsync();

        var toCancelled = await AddWalkInAsync(client, cancelled.Id, new { name = "Mira Chen" });
        var toEarly = await AddWalkInAsync(client, early.Id, new { name = "Mira Chen" });

        Assert.Equal(HttpStatusCode.Conflict, toCancelled.StatusCode);
        Assert.Equal("This event was cancelled.", (await toCancelled.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
        Assert.Equal(HttpStatusCode.Conflict, toEarly.StatusCode);
        Assert.Equal("Check-in hasn’t opened yet.", (await toEarly.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
        Assert.Empty((await factory.LoadEventAsync(cancelled.Id)).Rsvps);
        Assert.Empty((await factory.LoadEventAsync(early.Id)).Rsvps);
    }

    // L2-092 AC5: Given a System Admin without a lead role, when they add a walk-in, then it is audited.
    [Fact]
    public async Task A_System_Admin_adding_a_walk_in_without_a_lead_role_is_audited()
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", Soon);
        var priya = await factory.AddMemberAsync("Priya Shah");

        await AddWalkInAsync(factory.ClientFor(priya, Role.SystemAdmin), e.Id, new { name = "Mira Chen" });

        var entry = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking().SingleAsync(a => a.TargetId == e.Id.ToString()));
        Assert.Equal(("event.walk_in_added", "Event", priya.ProfileId), (entry.Action, entry.TargetType, entry.ActorId));
        Assert.Contains("Mira Chen", entry.AfterJson);
    }
}
