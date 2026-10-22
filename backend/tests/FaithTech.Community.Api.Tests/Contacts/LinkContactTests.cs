// Traces to: L2-015, L2-013, L2-014
using System.Net;
using System.Net.Http.Json;
using System.Web;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Api.Tests.Invites;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Contacts;

public class LinkContactTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_owning_lead_is_notified_in_app_and_by_email_once_the_contact_verifies_their_email()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", email.ToUpperInvariant());
        var link = await SignUpAsync(email);

        Assert.Empty(await NotificationsForAsync(grace));
        Assert.Empty(factory.Emails.SentTo(await EmailOfAsync(grace)));

        await VerifyAsync(link);

        var notification = Assert.Single(await NotificationsForAsync(grace));
        Assert.Equal(
            (NotificationKind.ContactSignedUp, "Tomás Ortega just joined FaithTech", $"/contacts/{contact.Id}"),
            (notification.Kind, notification.Title, notification.LinkPath));
        var message = Assert.Single(factory.Emails.SentTo(await EmailOfAsync(grace)));
        Assert.Contains($"{CommunityApiFactory.WebAppOrigin}/contacts/{contact.Id}", message.Body);
    }

    [Fact]
    public async Task Archived_and_already_linked_contacts_raise_no_notification()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        var archived = await factory.CreateContactAsync(grace, "Tomás Ortega", email);
        await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/contacts/{archived.Id}/archive", null);
        var linked = await factory.CreateContactAsync(grace, "Tomás O.", email);
        await factory.WithDbAsync(async db =>
        {
            (await db.Contacts.SingleAsync(c => c.Id == linked.Id)).LinkTo(Guid.NewGuid());
            return await db.SaveChangesAsync();
        });

        await VerifyAsync(await SignUpAsync(email));

        Assert.Empty(await NotificationsForAsync(grace));
    }

    [Fact]
    public async Task Accepting_an_invite_with_a_new_account_counts_as_verifying_the_email()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        await factory.CreateContactAsync(grace, "Nate Oyelaran", email);
        var (_, token) = await factory.AddInviteAsync(grace, email);

        var accept = await factory.CreateClient().PostAsJsonAsync("/api/invites/accept", new { Token = token, Name = "Nate Oyelaran", Password = OidcFlow.Password });

        Assert.Equal(HttpStatusCode.NoContent, accept.StatusCode);
        Assert.Contains(await NotificationsForAsync(grace), n => n.Kind == NotificationKind.ContactSignedUp);
    }

    [Fact]
    public async Task A_matched_contact_offers_the_member_until_the_lead_links_it()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", email);
        var client = factory.ClientFor(grace, Role.CityLead);
        await VerifyAsync(await SignUpAsync(email, "Tomás A. Ortega"));
        var member = await ProfileOfAsync(email);

        var read = (await client.GetFromJsonAsync<Contact>($"/api/contacts/{contact.Id}"))!;
        var listed = Assert.Single(await client.ListContactsAsync());

        Assert.Equal(new ContactMatch(member, "Tomás A. Ortega"), read.Match);
        Assert.Equal("SignedUp", listed.Status);
    }

    [Fact]
    public async Task Linking_keeps_the_notes_and_shows_the_members_name_and_photo()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var tomas = await factory.AddMemberAsync("Tomás A. Ortega");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", notes: "Private follow-up.");
        var client = factory.ClientFor(grace, Role.CityLead);

        var response = await client.PostAsJsonAsync($"/api/contacts/{contact.Id}/link", new { ProfileId = tomas.ProfileId, DiscardNotes = false });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var linked = (await response.Content.ReadFromJsonAsync<Contact>())!;
        Assert.Equal(("Tomás A. Ortega", (Guid?)tomas.ProfileId, (ContactMatch?)null, 1), (linked.Name, linked.LinkedProfileId, linked.Match, linked.NoteCount));
        Assert.Equal("Member", Assert.Single(await client.ListContactsAsync()).Status);
        Assert.Single((await client.GetFromJsonAsync<Note[]>($"/api/contacts/{contact.Id}/notes"))!);
    }

    [Fact]
    public async Task Linking_and_discarding_notes_deletes_the_private_notes()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var tomas = await factory.AddMemberAsync("Tomás Ortega");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega", notes: "Private follow-up.");

        var response = await factory.ClientFor(grace, Role.CityLead)
            .PostAsJsonAsync($"/api/contacts/{contact.Id}/link", new { ProfileId = tomas.ProfileId, DiscardNotes = true });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, await factory.WithDbAsync(db => db.ContactNotes.CountAsync(n => n.ContactId == contact.Id)));
    }

    [Fact]
    public async Task A_contact_links_once_to_a_profile_that_exists()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var tomas = await factory.AddMemberAsync("Tomás Ortega");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");
        var client = factory.ClientFor(grace, Role.CityLead);

        var unknown = await client.PostAsJsonAsync($"/api/contacts/{contact.Id}/link", new { ProfileId = Guid.NewGuid() });
        await client.PostAsJsonAsync($"/api/contacts/{contact.Id}/link", new { ProfileId = tomas.ProfileId });
        var again = await client.PostAsJsonAsync($"/api/contacts/{contact.Id}/link", new { ProfileId = tomas.ProfileId });

        Assert.Equal((HttpStatusCode.NotFound, HttpStatusCode.Conflict), (unknown.StatusCode, again.StatusCode));
    }

    [Fact]
    public async Task Another_lead_cannot_link_someone_elses_contact()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var tomas = await factory.AddMemberAsync("Tomás Ortega");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");

        var response = await factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead)
            .PostAsJsonAsync($"/api/contacts/{contact.Id}/link", new { ProfileId = tomas.ProfileId });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Saving_a_contact_with_a_members_email_offers_save_and_link()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        await VerifyAsync(await SignUpAsync(email, "Kwame Asante"));
        var client = factory.ClientFor(grace, Role.CityLead);

        var offered = await client.PostAsJsonAsync("/api/contacts", NewContact("Kwame", email));
        var problem = (await offered.Content.ReadFromJsonAsync<ProblemDetails>())!;
        Assert.Equal(HttpStatusCode.Conflict, offered.StatusCode);
        Assert.Equal("Kwame Asante", problem.Extensions["memberName"]!.ToString());
        Assert.Empty(await client.ListContactsAsync());

        var linked = await client.PostAsJsonAsync("/api/contacts", new { Name = "Kwame", Email = email, LinkToMember = true });

        Assert.Equal(HttpStatusCode.Created, linked.StatusCode);
        var contact = (await linked.Content.ReadFromJsonAsync<Contact>())!;
        Assert.Equal(("Kwame Asante", (Guid?)await ProfileOfAsync(email)), (contact.Name, contact.LinkedProfileId));
    }

    [Fact]
    public async Task An_unverified_account_is_not_offered_for_linking()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = $"{Guid.NewGuid():N}@example.org";
        await SignUpAsync(email, "Kwame Asante");

        var response = await factory.ClientFor(grace, Role.CityLead).PostAsJsonAsync("/api/contacts", NewContact("Kwame", email));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Null((await response.Content.ReadFromJsonAsync<Contact>())!.Match);
    }

    [Fact]
    public async Task A_system_admin_linking_another_leads_contact_is_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var tomas = await factory.AddMemberAsync("Tomás Ortega");
        var contact = await factory.CreateContactAsync(grace, "Tomás Ortega");

        await factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin)
            .PostAsJsonAsync($"/api/contacts/{contact.Id}/link", new { ProfileId = tomas.ProfileId });

        Assert.True(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(e => e.TargetId == contact.Id.ToString() && e.Action == "contact.linked")));
    }

    private async Task<(Guid UserId, string Token)> SignUpAsync(string email, string name = "Tomás Ortega")
    {
        await factory.CreateClient().PostAsJsonAsync("/api/account/sign-up", new { name, email, password = OidcFlow.Password });
        var body = factory.Emails.SentTo(email).Last().Body;
        var url = new Uri(body.Split('\n').Single(l => l.StartsWith(CommunityApiFactory.WebAppOrigin)));
        var query = HttpUtility.ParseQueryString(url.Query);
        return (Guid.Parse(query["userId"]!), query["token"]!);
    }

    private async Task VerifyAsync((Guid UserId, string Token) link) =>
        (await factory.CreateClient().PostAsJsonAsync("/api/account/verify-email", new { link.UserId, link.Token })).EnsureSuccessStatusCode();

    private Task<List<Notification>> NotificationsForAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Notifications.AsNoTracking().Where(n => n.RecipientId == member.ProfileId).ToListAsync());

    private Task<string> EmailOfAsync(ProfileClients.Member member) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Id == member.UserId).Select(u => u.Email!).SingleAsync());

    private Task<Guid> ProfileOfAsync(string email) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Email == email).Select(u => u.ProfileId).SingleAsync());
}
