// Traces to: L2-029, L2-028
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Announcements;

public class SendAnnouncementTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Sent(Guid Id, int RecipientCount, int EmailCount);

    public sealed record RecipientCount(int Count);

    private static object Everyone => new { Kind = "Everyone" };

    private static object ToRoles(params string[] roles) => new { Kind = "Roles", Roles = roles };

    private static object ToRsvps(Guid eventId) => new { Kind = "EventRsvps", EventId = eventId };

    private static object Announcement(object audience, string subject = "Builders Night moves to Kestrel Labs",
        string body = "Same time, new venue.", bool alsoEmail = true) =>
        new { Subject = subject, Body = body, AlsoEmail = alsoEmail, Audience = audience };

    [Fact]
    public async Task A_communications_lead_sends_to_everyone_and_each_member_gets_a_notification_and_an_email()
    {
        // Given a Communications Lead and two members
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);
        var members = await factory.WithDbAsync(db => db.Users.CountAsync(u => db.Profiles.Any(p => p.UserId == u.Id && !p.IsSuspended)));
        var emailable = await factory.WithDbAsync(db =>
            db.Users.CountAsync(u => db.Profiles.Any(p => p.UserId == u.Id && !p.IsSuspended && !p.AnnouncementEmailsOptedOut)));

        // When she sends an announcement to everyone
        var response = await client.PostAsJsonAsync("/api/announcements", Announcement(Everyone));

        // Then every member gets it in the app and by email
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var sent = (await response.Content.ReadFromJsonAsync<Sent>())!;
        Assert.Equal((members, emailable), (sent.RecipientCount, sent.EmailCount));
        foreach (var member in new[] { ruth, jonah })
        {
            var notification = Assert.Single(await NotificationsAsync(member));
            Assert.Equal((NotificationKind.Announcement, "Builders Night moves to Kestrel Labs", "/announcements", (Guid?)hannah.ProfileId),
                (notification.Kind, notification.Title, notification.LinkPath, notification.ActorId));
            var email = Assert.Single(await EmailsAsync(member));
            Assert.Equal("Builders Night moves to Kestrel Labs", email.Subject);
            Assert.Contains("Same time, new venue.", email.Body);
        }

        var stored = await factory.WithDbAsync(db => db.Announcements.Include(a => a.Recipients).SingleAsync(a => a.Id == sent.Id));
        Assert.Equal((hannah.ProfileId, true, members), (stored.SenderId, stored.AlsoEmail, stored.Recipients.Count));
    }

    [Fact]
    public async Task Sending_to_roles_reaches_only_members_holding_one_of_them()
    {
        var admin = await factory.AddMemberAsync("Priya Shah");
        var engineer = await factory.AddMemberAsync("Samuel Mensah", p => p.AddRole(Role.ProductEngineer, Guid.Empty, DateTime.UtcNow));
        var volunteer = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));
        var attendee = await factory.AddMemberAsync("Jonah Bell", p => p.AddRole(Role.Attendee, Guid.Empty, DateTime.UtcNow));
        var client = factory.ClientFor(admin, Role.SystemAdmin);
        var holders = await factory.WithDbAsync(db => db.Profiles.CountAsync(p => !p.IsSuspended && p.Roles.Any(r => r.Definition!.Key == nameof(Role.ProductEngineer) || r.Definition!.Key == nameof(Role.Volunteer))));

        var response = await client.PostAsJsonAsync("/api/announcements", Announcement(ToRoles("ProductEngineer", "Volunteer")));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(holders, (await response.Content.ReadFromJsonAsync<Sent>())!.RecipientCount);
        Assert.Single(await NotificationsAsync(engineer));
        Assert.Single(await NotificationsAsync(volunteer));
        Assert.Empty(await NotificationsAsync(attendee));
        Assert.Empty(await NotificationsAsync(admin));
    }

    [Fact]
    public async Task Sending_to_an_events_rsvp_list_reaches_the_members_who_rsvped()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var going = await factory.AddMemberAsync("Tomás Ortega");
        var notGoing = await factory.AddMemberAsync("Leah Thompson");
        var ev = await factory.AddEventAsync("Toronto Builders Night", TimeSpan.FromDays(7));
        await factory.WithDbAsync(async db =>
        {
            var tracked = await db.Events.Include(e => e.Rsvps).SingleAsync(e => e.Id == ev.Id);
            tracked.Rsvp(going.ProfileId, factory.Time.GetUtcNow());
            tracked.GuestRsvp("A Guest", "guest@example.org", factory.Time.GetUtcNow());
            return await db.SaveChangesAsync();
        });
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);

        var count = await client.PostAsJsonAsync("/api/announcements/recipient-count", ToRsvps(ev.Id));
        var response = await client.PostAsJsonAsync("/api/announcements", Announcement(ToRsvps(ev.Id)));

        Assert.Equal(new RecipientCount(1), await count.Content.ReadFromJsonAsync<RecipientCount>());
        Assert.Equal(1, (await response.Content.ReadFromJsonAsync<Sent>())!.RecipientCount);
        Assert.Single(await NotificationsAsync(going));
        Assert.Empty(await NotificationsAsync(notGoing));
    }

    [Fact]
    public async Task An_unknown_event_is_a_validation_error()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");

        var response = await factory.ClientFor(hannah, Role.CommunicationsLead)
            .PostAsJsonAsync("/api/announcements", Announcement(ToRsvps(Guid.NewGuid())));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Contains("Audience.EventId", problem.Errors.Keys);
    }

    [Fact]
    public async Task Members_who_opted_out_get_it_in_the_app_but_not_by_email()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p =>
        {
            p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow);
            p.SetAnnouncementEmailOptOut(true);
        });
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);

        var response = await client.PostAsJsonAsync("/api/announcements", Announcement(ToRoles("Volunteer")));

        var sent = (await response.Content.ReadFromJsonAsync<Sent>())!;
        Assert.Equal(sent.RecipientCount - 1, sent.EmailCount);
        Assert.Single(await NotificationsAsync(ruth));
        Assert.Empty(await EmailsAsync(ruth));
    }

    [Fact]
    public async Task Turning_off_also_send_by_email_sends_it_in_the_app_only()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Attendee, Guid.Empty, DateTime.UtcNow));

        var response = await factory.ClientFor(hannah, Role.CommunicationsLead)
            .PostAsJsonAsync("/api/announcements", Announcement(ToRoles("Attendee"), alsoEmail: false));

        Assert.Equal(0, (await response.Content.ReadFromJsonAsync<Sent>())!.EmailCount);
        Assert.Single(await NotificationsAsync(ruth));
        Assert.Empty(await EmailsAsync(ruth));
    }

    [Fact]
    public async Task Suspended_members_are_left_out()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var suspended = await factory.AddMemberAsync("Gone Away", p =>
        {
            p.AddRole(Role.CreateLead, Guid.Empty, DateTime.UtcNow);
            p.Suspend("Spam", DateTime.UtcNow);
        });

        await factory.ClientFor(hannah, Role.CommunicationsLead).PostAsJsonAsync("/api/announcements", Announcement(ToRoles("CreateLead")));

        Assert.Empty(await NotificationsAsync(suspended));
    }

    [Fact]
    public async Task An_empty_subject_or_body_answers_with_both_field_errors_and_sends_nothing()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var before = await factory.WithDbAsync(db => db.Announcements.CountAsync());

        var response = await factory.ClientFor(hannah, Role.CommunicationsLead)
            .PostAsJsonAsync("/api/announcements", Announcement(Everyone, subject: " ", body: ""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Equal(["Add a subject so people know what it’s about."], problem.Errors["Subject"]);
        Assert.Equal(["Write a message of at least one sentence."], problem.Errors["Body"]);
        Assert.Equal(before, await factory.WithDbAsync(db => db.Announcements.CountAsync()));
    }

    [Fact]
    public async Task A_role_audience_needs_at_least_one_known_role()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);

        var none = await client.PostAsJsonAsync("/api/announcements", Announcement(ToRoles()));
        var unknown = await client.PostAsJsonAsync("/api/announcements/recipient-count", ToRoles("Wizard"));

        Assert.Equal(HttpStatusCode.BadRequest, none.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    public async Task Anyone_else_gets_403_for_sending_and_for_the_count(Role role)
    {
        var member = await factory.AddMemberAsync("Marcus Lee");
        var client = factory.ClientFor(member, role);

        var send = await client.PostAsJsonAsync("/api/announcements", Announcement(Everyone));
        var count = await client.PostAsJsonAsync("/api/announcements/recipient-count", Everyone);

        Assert.Equal((HttpStatusCode.Forbidden, HttpStatusCode.Forbidden), (send.StatusCode, count.StatusCode));
    }

    [Fact]
    public async Task A_member_without_a_role_gets_403()
    {
        var member = await factory.AddMemberAsync("Jonah Bell");

        var send = await factory.ClientFor(member).PostAsJsonAsync("/api/announcements", Announcement(Everyone));

        Assert.Equal(HttpStatusCode.Forbidden, send.StatusCode);
    }

    [Fact]
    public async Task The_recipient_count_is_shown_before_sending_and_stores_nothing()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        await factory.AddMemberAsync("Esther Nakamura", p => p.AddRole(Role.EventLead, Guid.Empty, DateTime.UtcNow));
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);
        var holders = await factory.WithDbAsync(db => db.Profiles.CountAsync(p => !p.IsSuspended && p.Roles.Any(r => r.Definition!.Key == nameof(Role.EventLead))));
        var announcements = await factory.WithDbAsync(db => db.Announcements.CountAsync());

        var response = await client.PostAsJsonAsync("/api/announcements/recipient-count", ToRoles("EventLead"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new RecipientCount(holders), await response.Content.ReadFromJsonAsync<RecipientCount>());
        Assert.Equal(announcements, await factory.WithDbAsync(db => db.Announcements.CountAsync()));
    }

    private Task<List<Notification>> NotificationsAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Notifications.Where(n => n.RecipientId == member.ProfileId && n.Kind == NotificationKind.Announcement).ToListAsync());

    private Task<List<Infrastructure.Email.OutboxMessage>> EmailsAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(async db =>
        {
            var address = await db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email).SingleAsync();
            return await db.OutboxMessages.Where(m => m.To == address).ToListAsync();
        });
}
