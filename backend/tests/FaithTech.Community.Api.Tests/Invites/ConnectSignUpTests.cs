// Traces to: L2-083, L2-084, L2-012, L2-015
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Contacts;
using FaithTech.Community.Api.Tests.Events;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Invites;

public class ConnectSignUpTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Signing_up_through_the_link_creates_an_unverified_account_with_no_role_and_no_contact_yet()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var token = await factory.ConnectTokenOfAsync(grace);
        var email = $"{Guid.NewGuid():N}@example.org";

        var response = await factory.CreateClient().PostAsJsonAsync("/api/connect/sign-up",
            new { token, name = " Tomás Ortega ", email, password = Identity.OidcFlow.Password });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var (user, profile) = await AccountAsync(email);
        Assert.False(user.EmailConfirmed);
        Assert.Equal("Tomás Ortega", profile.Name);
        Assert.Empty(profile.Roles);
        Assert.Single(factory.Emails.SentTo(email));
        Assert.Empty(await ContactsOfAsync(grace));
        Assert.Empty(await NotificationsForAsync(grace));
    }

    [Fact]
    public async Task Verifying_the_email_creates_a_linked_contact_for_the_lead_and_tells_them()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var token = await factory.ConnectTokenOfAsync(grace);
        var email = $"{Guid.NewGuid():N}@example.org";
        var link = await factory.SignUpThroughAsync(token, email);

        await factory.VerifyAsync(link);

        var (_, profile) = await AccountAsync(email);
        var contact = Assert.Single(await ContactsOfAsync(grace));
        Assert.Equal(("Tomás Ortega", email, profile.Id), (contact.Name, contact.Email, contact.LinkedProfileId));
        var notification = Assert.Single(await NotificationsForAsync(grace));
        Assert.Equal(
            (NotificationKind.ContactSignedUp, "Tomás Ortega connected with you", $"/contacts/{contact.Id}"),
            (notification.Kind, notification.Title, notification.LinkPath));
        var message = Assert.Single(await factory.QueuedEmailsToAsync(await factory.EmailOfAsync(grace)));
        Assert.Equal("Tomás Ortega connected with you", message.Subject);
        Assert.Contains($"{CommunityApiFactory.WebAppOrigin}/contacts/{contact.Id}", message.Body);
        Assert.Empty((await factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == profile.Id))).Roles);
    }

    [Fact]
    public async Task The_leads_existing_contact_with_that_email_is_linked_instead_of_a_second_one_even_when_archived()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        var existing = await factory.CreateContactAsync(grace, "Tomás from Builders Night", email.ToUpperInvariant(), notes: "Wants to mentor.");
        await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/contacts/{existing.Id}/archive", null);
        var token = await factory.ConnectTokenOfAsync(grace);

        await factory.VerifyAsync(await factory.SignUpThroughAsync(token, email));

        var contact = Assert.Single(await ContactsOfAsync(grace));
        Assert.Equal(existing.Id, contact.Id);
        Assert.Null(contact.ArchivedAtUtc);
        Assert.Equal((await AccountAsync(email)).Profile.Id, contact.LinkedProfileId);
        Assert.Equal(1, await factory.WithDbAsync(db => db.ContactNotes.CountAsync(n => n.ContactId == existing.Id)));
        Assert.Equal("Tomás Ortega connected with you", Assert.Single(await NotificationsForAsync(grace)).Title);
    }

    [Fact]
    public async Task Other_leads_with_the_same_email_still_get_the_just_joined_notification()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var email = $"{Guid.NewGuid():N}@example.org";
        var theirs = await factory.CreateContactAsync(marcus, "Tomás Ortega", email);
        var token = await factory.ConnectTokenOfAsync(grace);

        await factory.VerifyAsync(await factory.SignUpThroughAsync(token, email));

        var notice = Assert.Single(await NotificationsForAsync(marcus));
        Assert.Equal(("Tomás Ortega just joined FaithTech", $"/contacts/{theirs.Id}"), (notice.Title, notice.LinkPath));
        Assert.Null((await factory.WithDbAsync(db => db.Contacts.AsNoTracking().SingleAsync(c => c.Id == theirs.Id))).LinkedProfileId);
    }

    [Fact]
    public async Task The_new_contact_is_private_to_the_lead_and_System_Admin()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var token = await factory.ConnectTokenOfAsync(grace);
        var email = $"{Guid.NewGuid():N}@example.org";
        await factory.VerifyAsync(await factory.SignUpThroughAsync(token, email));
        var contact = Assert.Single(await ContactsOfAsync(grace));

        var estherClient = factory.ClientFor(esther, Role.CityLead);
        Assert.DoesNotContain(await estherClient.ListContactsAsync(), c => c.Id == contact.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await estherClient.GetAsync($"/api/contacts/{contact.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await factory.ClientFor(grace, Role.CityLead).GetAsync($"/api/contacts/{contact.Id}")).StatusCode);
        var priya = await factory.AddMemberAsync("Priya Shah");
        Assert.Equal(HttpStatusCode.OK, (await factory.ClientFor(priya, Role.SystemAdmin).GetAsync($"/api/contacts/{contact.Id}")).StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(e => e.TargetId == contact.Id.ToString() && e.Action == "contact.viewed")));
    }

    [Fact]
    public async Task An_email_that_already_has_an_account_gets_the_same_answer_and_nothing_is_linked()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var jonah = await factory.AddMemberAsync("Jonah Bell");
        var email = await factory.EmailOfAsync(jonah);
        var token = await factory.ConnectTokenOfAsync(grace);

        var response = await factory.CreateClient().PostAsJsonAsync("/api/connect/sign-up",
            new { token, name = "Someone", email, password = Identity.OidcFlow.Password });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(1, await factory.WithDbAsync(db => db.Users.CountAsync(u => u.Email == email)));
        Assert.False(await factory.WithDbAsync(db => db.PendingConnections.AnyAsync(p => p.ProfileId == jonah.ProfileId)));
        Assert.Empty(factory.Emails.SentTo(email));
    }

    [Fact]
    public async Task An_unknown_or_replaced_link_creates_no_account()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var old = await factory.ConnectTokenOfAsync(grace);
        await factory.ClientFor(grace, Role.CityLead).PostAsync("/api/connect/link", null);
        var email = $"{Guid.NewGuid():N}@example.org";

        var replaced = await factory.CreateClient().PostAsJsonAsync("/api/connect/sign-up",
            new { token = old, name = "Tomás", email, password = Identity.OidcFlow.Password });
        var unknown = await factory.CreateClient().PostAsJsonAsync("/api/connect/sign-up",
            new { token = "nope", name = "Tomás", email, password = Identity.OidcFlow.Password });

        Assert.Equal(HttpStatusCode.NotFound, replaced.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.False(await factory.WithDbAsync(db => db.Users.AnyAsync(u => u.Email == email)));
    }

    [Fact]
    public async Task The_sign_up_rules_are_the_same_as_normal_sign_up()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var token = await factory.ConnectTokenOfAsync(grace);

        var response = await factory.CreateClient().PostAsJsonAsync("/api/connect/sign-up",
            new { token, name = new string('a', 101), email = "not-an-email", password = "short" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal(["Email", "Name", "Password"], problem!.Errors.Keys.Order());
        Assert.Equal("Use 100 characters or fewer for your name.", problem.Errors["Name"][0]);
    }

    // Traces to: L2-125 AC1 (docs/detailed-designs/reports/reports-dashboard): connect sign-up records the join time.
    [Fact]
    public async Task Signing_up_through_the_link_records_the_join_time()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var token = await factory.ConnectTokenOfAsync(grace);
        var email = $"{Guid.NewGuid():N}@example.org";

        await factory.CreateClient().PostAsJsonAsync("/api/connect/sign-up",
            new { token, name = "Tomás Ortega", email, password = Identity.OidcFlow.Password });

        Assert.Equal(factory.Time.GetUtcNow().UtcDateTime, (await AccountAsync(email)).Profile.JoinedAtUtc);
    }

    private Task<(Application.Identity.CommunityUser User, Profile Profile)> AccountAsync(string email) =>
        factory.WithDbAsync(async db =>
        {
            var user = await db.Users.AsNoTracking().SingleAsync(u => u.Email == email);
            return (user, await db.Profiles.AsNoTracking().SingleAsync(p => p.Id == user.ProfileId));
        });

    private Task<List<Domain.Contacts.Contact>> ContactsOfAsync(ProfileClients.Member lead) =>
        factory.WithDbAsync(db => db.Contacts.AsNoTracking().Where(c => c.OwnerId == lead.ProfileId).ToListAsync());

    private Task<List<Notification>> NotificationsForAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Notifications.AsNoTracking().Where(n => n.RecipientId == member.ProfileId).ToListAsync());
}
