// Traces to: L2-022, L2-020 AC5
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

public class RsvpTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);

    [Fact]
    public async Task Anonymous_visitor_gets_401_for_rsvp()
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);

        var response = await factory.CreateClient().PostAsync($"/api/events/{existing.Id}/rsvps", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC1: Given a signed-in member and an open event, when they RSVP, then they receive an in-app and email
    // confirmation with the .ics attached.
    [Fact]
    public async Task Member_rsvps_and_gets_an_in_app_and_email_confirmation_with_the_ics()
    {
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week);
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var address = await factory.EmailOfAsync(leah);

        var response = await factory.ClientFor(leah).PostAsync($"/api/events/{existing.Id}/rsvps", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var saved = await factory.LoadEventAsync(existing.Id);
        Assert.Single(saved.Rsvps, r => r.ProfileId == leah.ProfileId);
        var notification = await factory.WithDbAsync(db => db.Notifications.AsNoTracking().SingleAsync(n => n.RecipientId == leah.ProfileId));
        Assert.Equal((NotificationKind.RsvpConfirmed, "You’re going to Toronto Builders Night", $"/events/{existing.Id}"),
            (notification.Kind, notification.Title, notification.LinkPath));
        var email = Assert.Single(factory.Emails.SentTo(address));
        Assert.Equal("You’re going to Toronto Builders Night", email.Subject);
        Assert.Contains($"{CommunityApiFactory.WebAppOrigin}/events/{existing.Id}", email.Body);
        var ics = Assert.Single(email.Attachments!);
        Assert.Equal(("toronto-builders-night.ics", "text/calendar"), (ics.FileName, ics.ContentType));
        Assert.Contains($"UID:{existing.Id}@faithtech.community", ics.Content);
        Assert.Contains("SUMMARY:Toronto Builders Night", ics.Content);
    }

    [Fact]
    public async Task Rsvping_twice_keeps_one_rsvp_and_sends_one_confirmation()
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var address = await factory.EmailOfAsync(leah);
        var client = factory.ClientFor(leah);

        await client.PostAsync($"/api/events/{existing.Id}/rsvps", null);
        var again = await client.PostAsync($"/api/events/{existing.Id}/rsvps", null);

        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Single((await factory.LoadEventAsync(existing.Id)).Rsvps);
        Assert.Single(factory.Emails.SentTo(address));
    }

    // L2-020 AC5: Given an event at capacity, when anyone tries to RSVP, then the RSVP is refused with a
    // "this event is full" message.
    [Fact]
    public async Task An_event_at_capacity_refuses_the_rsvp_as_full()
    {
        var existing = await factory.AddEventAsync("Builders Night", Week, capacity: 2, rsvps: 2);
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(leah).PostAsync($"/api/events/{existing.Id}/rsvps", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("This event is full.", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
        Assert.Equal(2, (await factory.LoadEventAsync(existing.Id)).Rsvps.Count);
    }

    [Fact]
    public async Task A_cancelled_or_started_event_refuses_the_rsvp()
    {
        var cancelled = await factory.AddEventAsync("Panel", Week, cancelledBecause: "Venue flooded.");
        var started = await factory.AddEventAsync("Hackathon", -TimeSpan.FromHours(1), lasts: TimeSpan.FromDays(1));
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var client = factory.ClientFor(leah);

        var toCancelled = await client.PostAsync($"/api/events/{cancelled.Id}/rsvps", null);
        var toStarted = await client.PostAsync($"/api/events/{started.Id}/rsvps", null);

        Assert.Equal(HttpStatusCode.Conflict, toCancelled.StatusCode);
        Assert.Equal("This event was cancelled.", (await toCancelled.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
        Assert.Equal(HttpStatusCode.Conflict, toStarted.StatusCode);
        Assert.Equal("This event has already started.", (await toStarted.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Rsvp_to_an_unknown_event_is_404()
    {
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(leah).PostAsync($"/api/events/{Guid.NewGuid()}/rsvps", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // AC2: Given an RSVP, when the member cancels it after confirming, then they are removed from the list and
    // can RSVP again any time before the event.
    [Fact]
    public async Task Member_cancels_their_rsvp_and_can_rsvp_again()
    {
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var existing = await factory.AddEventAsync("Builders Night", Week, members: [leah.ProfileId]);
        var client = factory.ClientFor(leah);

        var cancel = await client.DeleteAsync($"/api/events/{existing.Id}/rsvps/me");

        Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
        Assert.Empty((await factory.LoadEventAsync(existing.Id)).Rsvps);
        Assert.False((await client.GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}")).GetProperty("callerHasRsvp").GetBoolean());

        var again = await client.PostAsync($"/api/events/{existing.Id}/rsvps", null);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.True((await client.GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}")).GetProperty("callerHasRsvp").GetBoolean());
    }

    [Fact]
    public async Task Cancelling_without_an_rsvp_is_404()
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(leah).DeleteAsync($"/api/events/{existing.Id}/rsvps/me");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // AC3: Given an attendee who is not a lead or Staff, when they view an event, then they see only the RSVP count.
    [Theory]
    [InlineData]
    [InlineData(Role.Attendee, Role.Volunteer, Role.ProductEngineer)]
    public async Task An_attendee_sees_only_the_rsvp_count(params Role[] roles)
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var existing = await factory.AddEventAsync("Builders Night", Week, members: [ruth.ProfileId], guests: [("Abby Brooks", "abby@example.org")]);
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var json = await factory.ClientFor(leah, roles).GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");

        Assert.Equal(2, json.GetProperty("rsvpCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("rsvps").ValueKind);
        Assert.False(json.GetProperty("canExportRsvps").GetBoolean());
        Assert.DoesNotContain("abby@example.org", json.GetRawText());
    }

    // AC4: Given a lead, Staff or System Admin, when they view an event, then they see the full RSVP list. Guest
    // emails are shown to leads and System Admin only.
    [Theory]
    [InlineData(Role.EventLead, true)]
    [InlineData(Role.CityLead, true)]
    [InlineData(Role.CreateLead, true)]
    [InlineData(Role.CommunicationsLead, true)]
    [InlineData(Role.SystemAdmin, true)]
    [InlineData(Role.Staff, false)]
    public async Task Leads_Staff_and_System_Admins_see_the_list_and_only_leads_and_admins_see_guest_emails(Role role, bool seesEmails)
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var existing = await factory.AddEventAsync("Builders Night", Week, members: [ruth.ProfileId], guests: [("Abby Brooks", "abby@example.org")]);
        var viewer = await factory.AddMemberAsync("Grace Okonkwo");

        var json = await factory.ClientFor(viewer, role).GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");

        var rsvps = json.GetProperty("rsvps").EnumerateArray().ToList();
        Assert.Equal(["Abby Brooks", "Ruth Alvarez"], rsvps.Select(r => r.GetProperty("name").GetString()).Order());
        var member = rsvps.Single(r => r.GetProperty("name").GetString() == "Ruth Alvarez");
        Assert.Equal((ruth.ProfileId, false), (member.GetProperty("profileId").GetGuid(), member.GetProperty("isGuest").GetBoolean()));
        var guest = rsvps.Single(r => r.GetProperty("isGuest").GetBoolean());
        Assert.Equal(seesEmails ? "abby@example.org" : null, guest.GetProperty("guestEmail").GetString());
        Assert.Equal(seesEmails, json.GetProperty("canExportRsvps").GetBoolean());
    }

    // AC5: Given a lead or System Admin, when they choose "Export CSV" on the RSVP list, then a CSV of the list is downloaded.
    [Theory]
    [InlineData(Role.EventLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Leads_and_System_Admins_export_the_rsvp_list_as_csv(Role role)
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var existing = await factory.AddEventAsync("Builders Night", Week, members: [ruth.ProfileId], guests: [("Abby \"AB\" Brooks", "abby@example.org")]);
        var viewer = await factory.AddMemberAsync("Grace Okonkwo");

        var response = await factory.ClientFor(viewer, role).GetAsync($"/api/events/{existing.Id}/rsvps.csv");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("builders-night-rsvps.csv", response.Content.Headers.ContentDisposition?.FileNameStar ?? response.Content.Headers.ContentDisposition?.FileName);
        var lines = (await response.Content.ReadAsStringAsync()).TrimEnd().Split('\n').Select(l => l.TrimEnd('\r')).ToList();
        Assert.Equal("Name,Member or guest,Guest email,RSVP'd (UTC)", lines[0]);
        Assert.Contains(lines, l => l.StartsWith("\"Abby \"\"AB\"\" Brooks\",Guest,abby@example.org,", StringComparison.Ordinal));
        Assert.Contains(lines, l => l.StartsWith("Ruth Alvarez,Member,,", StringComparison.Ordinal));
        Assert.Equal(3, lines.Count);
    }

    [Theory]
    [InlineData(Role.Staff)]
    [InlineData(Role.Attendee)]
    public async Task Staff_and_attendees_cannot_export_the_rsvp_list(Role role)
    {
        var existing = await factory.AddEventAsync("Builders Night", Week, rsvps: 1);
        var viewer = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(viewer, role).GetAsync($"/api/events/{existing.Id}/rsvps.csv");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task The_page_names_the_host_and_their_event_role()
    {
        var marcus = await factory.AddMemberAsync("Marcus Lee", p => p.AddRole(Role.EventLead, Guid.Empty, DateTime.UtcNow));
        var existing = await factory.AddEventAsync("Builders Night", Week, createdBy: marcus.ProfileId);
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var json = await factory.ClientFor(leah).GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");

        Assert.Equal("Marcus Lee", json.GetProperty("hostName").GetString());
        Assert.Equal("Event Lead", json.GetProperty("hostRole").GetString());
    }
}
