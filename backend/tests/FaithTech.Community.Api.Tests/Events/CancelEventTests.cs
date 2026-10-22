// Traces to: L2-025
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

public class CancelEventTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static readonly TimeSpan Week = TimeSpan.FromDays(7);
    private const string Reason = "Our venue fell through. We’ll reschedule for January.";

    [Fact]
    public async Task Anonymous_visitor_gets_401_for_cancel()
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);

        var response = await factory.CreateClient().PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { reason = Reason });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC1: Given an Event Lead, City Lead or System Admin, when they cancel an event with a required reason after
    // confirming, then the event is marked cancelled and new RSVPs are refused.
    [Theory]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CityLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Event_manager_cancels_with_a_reason_and_new_rsvps_are_refused(Role role)
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);
        var esther = await factory.AddMemberAsync("Esther Nakamura");

        var response = await factory.ClientFor(esther, role).PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { reason = $"  {Reason} " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var saved = await factory.LoadEventAsync(existing.Id);
        Assert.Equal((true, (string?)Reason, 1, (Guid?)esther.ProfileId, (DateTimeOffset?)factory.Time.GetUtcNow()),
            (saved.IsCancelled, saved.CancellationReason, saved.Sequence, saved.CancelledById, saved.CancelledAt));

        var leah = await factory.AddMemberAsync("Leah Thompson");
        var rsvp = await factory.ClientFor(leah).PostAsync($"/api/events/{existing.Id}/rsvps", null);
        Assert.Equal(HttpStatusCode.Conflict, rsvp.StatusCode);
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer, Role.CreateLead)]
    public async Task Any_other_role_gets_403_and_nothing_changes(params Role[] roles)
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);
        var member = await factory.AddMemberAsync("Leah Thompson");

        var response = await factory.ClientFor(member, roles).PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { reason = Reason });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.False((await factory.LoadEventAsync(existing.Id)).IsCancelled);
    }

    // AC3: Given an empty reason, when they confirm, then an inline error asks them to tell attendees why.
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task An_empty_reason_is_400_asking_to_tell_attendees_why(string? reason)
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);
        var lead = await factory.AddMemberAsync("Esther Nakamura");

        var response = await factory.ClientFor(lead, Role.EventLead).PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { reason });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.Equal("Tell attendees why, so they aren’t left guessing.", errors.GetProperty("Reason")[0].GetString());
        Assert.False((await factory.LoadEventAsync(existing.Id)).IsCancelled);
    }

    [Fact]
    public async Task A_reason_over_500_characters_is_400()
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);
        var lead = await factory.AddMemberAsync("Esther Nakamura");

        var response = await factory.ClientFor(lead, Role.EventLead).PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { reason = new string('a', 501) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_unknown_event_is_404_and_a_cancelled_one_is_409()
    {
        var cancelled = await factory.AddEventAsync("Builders Night", Week, cancelledBecause: "Venue flooded.");
        var lead = await factory.AddMemberAsync("Esther Nakamura");
        var client = factory.ClientFor(lead, Role.EventLead);

        var unknown = await client.PostAsJsonAsync($"/api/events/{Guid.NewGuid()}/cancel", new { reason = Reason });
        var again = await client.PostAsJsonAsync($"/api/events/{cancelled.Id}/cancel", new { reason = Reason });

        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("This event is already cancelled.", (await again.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
    }

    // AC2: Given a cancelled event, when the cancellation completes, then every member and guest who RSVP'd
    // receives an email, and members also receive an in-app notification.
    [Fact]
    public async Task Every_member_and_guest_who_rsvpd_is_emailed_and_members_are_notified_in_app()
    {
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var guestEmail = $"{Guid.NewGuid():N}@example.org";
        var existing = await factory.AddEventAsync("Toronto Builders Night", Week,
            members: [ruth.ProfileId, jonah.ProfileId], guests: [("Abby Brooks", guestEmail)]);
        var lead = await factory.AddMemberAsync("Esther Nakamura");

        var response = await factory.ClientFor(lead, Role.CityLead).PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { reason = Reason });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        foreach (var address in new[] { await factory.EmailOfAsync(ruth), await factory.EmailOfAsync(jonah), guestEmail })
        {
            var email = Assert.Single(await factory.QueuedEmailsToAsync(address));
            Assert.Equal("Cancelled: Toronto Builders Night", email.Subject);
            Assert.Contains(Reason, email.Body);
            var ics = Assert.Single(email.Attachments!);
            Assert.Contains("STATUS:CANCELLED", ics.Content);
        }

        var notified = new[] { ruth.ProfileId, jonah.ProfileId };
        var notifications = await factory.WithDbAsync(db => db.Notifications.AsNoTracking()
            .Where(n => notified.Contains(n.RecipientId) || n.RecipientId == lead.ProfileId).ToListAsync());
        Assert.Equal(notified.Order(), notifications.Select(n => n.RecipientId).Order());
        Assert.All(notifications, n =>
        {
            Assert.Equal(NotificationKind.EventCancelled, n.Kind);
            Assert.Equal("Toronto Builders Night was cancelled", n.Title);
            Assert.Equal($"/events/{existing.Id}", n.LinkPath);
        });
    }

    [Fact]
    public async Task A_System_Admin_acting_without_an_event_role_is_audited()
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);
        var admin = await factory.AddMemberAsync("Priya Shah");

        (await factory.ClientFor(admin, Role.SystemAdmin).PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { reason = Reason }))
            .EnsureSuccessStatusCode();

        var entry = await factory.WithDbAsync(db => db.AuditEntries.AsNoTracking().SingleAsync(e => e.TargetId == existing.Id.ToString()));
        Assert.Equal(("event.cancelled", admin.ProfileId), (entry.Action, entry.ActorId));
    }

    [Fact]
    public async Task The_event_page_says_who_cancelled_it_and_when()
    {
        var existing = await factory.AddEventAsync("Builders Night", Week);
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        await factory.ClientFor(esther, Role.CityLead).PostAsJsonAsync($"/api/events/{existing.Id}/cancel", new { reason = Reason });
        var leah = await factory.AddMemberAsync("Leah Thompson");

        var json = await factory.ClientFor(leah).GetFromJsonAsync<JsonElement>($"/api/events/{existing.Id}");

        Assert.Equal("Esther Nakamura", json.GetProperty("cancelledByName").GetString());
        Assert.Equal(factory.Time.GetUtcNow(), json.GetProperty("cancelledAt").GetDateTimeOffset());
        Assert.Equal(Reason, json.GetProperty("cancellationReason").GetString());
    }
}
