// Traces to: L2-029
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
    private static object Everyone(bool alsoEmail = true, string subject = "Builders Night moves to Kestrel Labs") => new
    {
        Subject = subject,
        Body = "Same time, new place: Kestrel Labs on King Street.",
        Audience = new { Kind = "Everyone" },
        AlsoEmail = alsoEmail,
    };

    private static object ToRoles(params string[] roles) => new
    {
        Subject = "November hackathon: teams are forming",
        Body = "Team formation opens Monday.",
        Audience = new { Kind = "Roles", Roles = roles },
        AlsoEmail = true,
    };

    [Fact]
    public async Task Anonymous_visitor_gets_401()
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/announcements", Everyone());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // AC1: Given a Communications Lead or System Admin, when they send an announcement with a subject and body to
    // everyone, the holders of one or more chosen roles, or one event's RSVP list, then each recipient gets an
    // in-app notification.
    [Theory]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Sending_to_everyone_notifies_every_member_who_is_not_suspended(Role senderRole)
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim", p => p.AddRole(senderRole, Guid.Empty, DateTime.UtcNow));
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        var suspended = await factory.AddMemberAsync("Felix Wu", p => p.Suspend("Spam", DateTime.UtcNow));

        var response = await factory.ClientFor(hannah, senderRole).PostAsJsonAsync("/api/announcements", Everyone());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var sent = await response.Content.ReadFromJsonAsync<SentResponse>();
        var expected = await factory.WithDbAsync(db => db.Profiles.CountAsync(p => !p.IsSuspended));
        Assert.Equal(expected, sent!.RecipientCount);
        var notice = await NotificationsOfAsync(ruth);
        var single = Assert.Single(notice);
        Assert.Equal("Hannah Kim sent “Builders Night moves to Kestrel Labs”", single.Title);
        Assert.Equal("/announcements", single.LinkPath);
        Assert.Equal("Hannah Kim", single.ActorName);
        Assert.Empty(await NotificationsOfAsync(suspended));
        var stored = await factory.WithDbAsync(db => db.Announcements.Include(a => a.Recipients).SingleAsync(a => a.Id == sent.Id));
        Assert.Equal(hannah.ProfileId, stored.SenderId);
        Assert.Contains(stored.Recipients, r => r.ProfileId == ruth.ProfileId);
        Assert.DoesNotContain(stored.Recipients, r => r.ProfileId == suspended.ProfileId);
    }

    [Fact]
    public async Task Sending_to_roles_notifies_only_holders_of_any_chosen_role()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var engineer = await factory.AddMemberAsync("Nate Oyelaran", p => p.AddRole(Role.ProductEngineer, Guid.Empty, DateTime.UtcNow));
        var volunteer = await factory.AddMemberAsync("Ruth Alvarez", p => p.AddRole(Role.Volunteer, Guid.Empty, DateTime.UtcNow));
        var attendee = await factory.AddMemberAsync("Jonah Bell", p => p.AddRole(Role.Attendee, Guid.Empty, DateTime.UtcNow));

        var response = await factory.ClientFor(hannah, Role.CommunicationsLead)
            .PostAsJsonAsync("/api/announcements", ToRoles("ProductEngineer", "Volunteer"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(await NotificationsOfAsync(engineer));
        Assert.Single(await NotificationsOfAsync(volunteer));
        Assert.Empty(await NotificationsOfAsync(attendee));
        Assert.Equal(NotificationKind.Announcement, (await NotificationsOfAsync(engineer)).Single().Kind);
    }

    // AC1, "one event's RSVP list": the members who RSVP'd and are not suspended; guests have no in-app inbox.
    [Fact]
    public async Task Sending_to_an_events_rsvp_list_notifies_only_its_members()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var paused = await factory.AddMemberAsync("Paused Member", p => p.Suspend("Paused", DateTime.UtcNow));
        var stranger = await factory.AddMemberAsync("Not Going");
        var hackathon = await factory.AddEventAsync(
            "Hackathon: Tech for Shelters", TimeSpan.FromDays(14), members: [leah.ProfileId, paused.ProfileId], guests: [("Abby Chen", "abby@example.org")]);
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);
        var audience = new { Kind = "EventRsvps", EventId = hackathon.Id };

        var count = await client.PostAsJsonAsync("/api/announcements/recipient-count", audience);
        var response = await client.PostAsJsonAsync("/api/announcements", new { Subject = "Hackathon", Body = "See you there.", Audience = audience });

        Assert.Equal(1, (await count.Content.ReadFromJsonAsync<CountResponse>())!.Count);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(1, (await response.Content.ReadFromJsonAsync<SentResponse>())!.RecipientCount);
        Assert.Single(await NotificationsOfAsync(leah));
        Assert.Empty(await NotificationsOfAsync(paused));
        Assert.Empty(await NotificationsOfAsync(stranger));
    }

    [Fact]
    public async Task An_event_audience_needs_a_known_event()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);

        var missing = await client.PostAsJsonAsync("/api/announcements/recipient-count", new { Kind = "EventRsvps" });
        var unknown = await client.PostAsJsonAsync("/api/announcements", new
        {
            Subject = "Hackathon",
            Body = "See you there.",
            Audience = new { Kind = "EventRsvps", EventId = Guid.NewGuid() },
        });

        Assert.Equal(["Choose an event."], (await missing.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["EventId"]);
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        Assert.Equal(["Choose an event."], (await unknown.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["Audience.EventId"]);
    }

    // AC2: Given an empty subject or body, when they send, then inline errors are shown.
    [Fact]
    public async Task Empty_subject_and_body_are_400_with_an_error_for_each()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");

        var response = await factory.ClientFor(hannah, Role.CommunicationsLead).PostAsJsonAsync("/api/announcements", new
        {
            Subject = " ",
            Body = "",
            Audience = new { Kind = "Everyone" },
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal(["Add a subject so people know what it’s about."], problem!.Errors["Subject"]);
        Assert.Equal(["Write a message of at least one sentence."], problem.Errors["Body"]);
        Assert.Empty(await factory.WithDbAsync(db => db.Announcements.Where(a => a.SenderId == hannah.ProfileId).ToListAsync()));
    }

    [Fact]
    public async Task A_role_audience_needs_at_least_one_known_role()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);

        var none = await client.PostAsJsonAsync("/api/announcements", ToRoles());
        var unknown = await client.PostAsJsonAsync("/api/announcements", ToRoles("Wizard"));

        Assert.Equal(HttpStatusCode.BadRequest, none.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
    }

    // AC3: Given any other user, when they call the send API, then the response is 403.
    [Theory]
    [InlineData(new Role[0])]
    [InlineData(new[] { Role.CityLead })]
    [InlineData(new[] { Role.EventLead, Role.Volunteer })]
    [InlineData(new[] { Role.Staff })]
    public async Task Anyone_else_gets_403_even_for_an_invalid_announcement(Role[] roles)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace, roles);

        var send = await client.PostAsJsonAsync("/api/announcements", Everyone());
        var invalid = await client.PostAsJsonAsync("/api/announcements", new { Subject = "", Body = "" });
        var count = await client.PostAsJsonAsync("/api/announcements/recipient-count", new { Kind = "Everyone" });

        Assert.Equal(HttpStatusCode.Forbidden, send.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalid.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, count.StatusCode);
        Assert.Empty(await factory.WithDbAsync(db => db.Announcements.Where(a => a.SenderId == grace.ProfileId).ToListAsync()));
    }

    // AC4: Given the compose page, when the audience is chosen, then the number of recipients is shown before sending.
    [Fact]
    public async Task The_recipient_count_matches_the_audience_before_sending()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var role = Role.CreateLead;
        await factory.AddMemberAsync("Samuel Mensah", p => p.AddRole(role, Guid.Empty, DateTime.UtcNow));
        await factory.AddMemberAsync("Paused Lead", p =>
        {
            p.AddRole(role, Guid.Empty, DateTime.UtcNow);
            p.Suspend("Paused", DateTime.UtcNow);
        });
        var client = factory.ClientFor(hannah, Role.CommunicationsLead);
        var holders = await factory.WithDbAsync(db => db.Profiles.CountAsync(p => !p.IsSuspended && p.Roles.Any(r => r.Role == role)));
        var everyone = await factory.WithDbAsync(db => db.Profiles.CountAsync(p => !p.IsSuspended));

        var byRole = await client.PostAsJsonAsync("/api/announcements/recipient-count", new { Kind = "Roles", Roles = new[] { "CreateLead" } });
        var all = await client.PostAsJsonAsync("/api/announcements/recipient-count", new { Kind = "Everyone" });

        Assert.Equal(holders, (await byRole.Content.ReadFromJsonAsync<CountResponse>())!.Count);
        Assert.Equal(everyone, (await all.Content.ReadFromJsonAsync<CountResponse>())!.Count);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/announcements/recipient-count", new { Kind = "Roles" })).StatusCode);
    }

    // AC5: Given "Also send by email" is on (the default), when the announcement is sent, then recipients who have
    // not opted out also receive it by email.
    [Fact]
    public async Task Also_send_by_email_emails_everyone_who_has_not_opted_out()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var role = Role.CityLead;
        var grace = await factory.AddMemberAsync("Grace Okonkwo", p => p.AddRole(role, Guid.Empty, DateTime.UtcNow));
        var esther = await factory.AddMemberAsync("Esther Nakamura", p =>
        {
            p.AddRole(role, Guid.Empty, DateTime.UtcNow);
            p.SetAnnouncementEmailOptOut(true);
        });

        var response = await factory.ClientFor(hannah, Role.CommunicationsLead).PostAsJsonAsync("/api/announcements", new
        {
            Subject = "City lead call moves to Thursday",
            Body = "Same link as always.",
            Audience = new { Kind = "Roles", Roles = new[] { "CityLead" } },
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var sent = await response.Content.ReadFromJsonAsync<SentResponse>();
        var holders = await factory.WithDbAsync(db => db.Profiles.Where(p => !p.IsSuspended && p.Roles.Any(r => r.Role == role)).ToListAsync());
        Assert.Equal(holders.Count, sent!.RecipientCount);
        Assert.Equal(holders.Count(p => !p.AnnouncementEmailsOptedOut), sent.EmailCount);
        var email = Assert.Single(factory.Emails.SentTo(await AddressOfAsync(grace)));
        Assert.Equal("City lead call moves to Thursday", email.Subject);
        Assert.Contains("Same link as always.", email.Body);
        Assert.Contains($"{CommunityApiFactory.WebAppOrigin}/announcements", email.Body);
        Assert.Empty(factory.Emails.SentTo(await AddressOfAsync(esther)));
        Assert.Single(await NotificationsOfAsync(esther));
    }

    [Fact]
    public async Task Turning_email_off_sends_in_app_only()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");

        var response = await factory.ClientFor(hannah, Role.CommunicationsLead)
            .PostAsJsonAsync("/api/announcements", Everyone(alsoEmail: false, subject: "In-app only"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(0, (await response.Content.ReadFromJsonAsync<SentResponse>())!.EmailCount);
        Assert.DoesNotContain(factory.Emails.SentTo(await AddressOfAsync(ruth)), m => m.Subject == "In-app only");
        Assert.Single(await NotificationsOfAsync(ruth));
    }

    private Task<List<Notification>> NotificationsOfAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Notifications.Where(n => n.RecipientId == member.ProfileId && n.Kind == NotificationKind.Announcement).ToListAsync());

    private Task<string> AddressOfAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync());

    public sealed record SentResponse(Guid Id, int RecipientCount, int EmailCount);

    public sealed record CountResponse(int Count);
}
