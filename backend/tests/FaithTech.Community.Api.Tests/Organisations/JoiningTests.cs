using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using System.Web;
using FaithTech.Community.Api.Tests.Invites;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-132 AC1. Signing up on an organisation's host makes the account a member there: a new email gets an
// account and a profile on that host; an email that already has an account gets the same 202 and a verification email,
// and confirming it creates the profile with the name given on the form.
public class JoiningTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string Password = "a-long-enough-passphrase";

    [Fact]
    public async Task Signing_up_with_a_new_email_on_another_organisations_host_creates_the_profile_there()
    {
        var northside = await factory.AddOrganisationAsync();
        var email = UniqueEmail();

        var response = await On(northside).PostAsJsonAsync("/api/account/sign-up", new { name = "Ana Lima", email, password = Password });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var profiles = await ProfilesOf(email);
        Assert.Equal([(northside.Id, "Ana Lima")], profiles);
        Assert.StartsWith($"{northside.Origin}/verify-email?", VerificationLink(email));
    }

    [Fact]
    public async Task An_existing_email_gets_the_same_answer_and_joins_on_verification()
    {
        var northside = await factory.AddOrganisationAsync();
        var email = UniqueEmail();
        await factory.CreateClient().PostAsJsonAsync("/api/account/sign-up", new { name = "Grace Okonkwo", email, password = Password });
        await Confirm(factory.CreateClient(), VerificationLink(email));
        factory.Emails.Sent.Clear();

        var response = await On(northside).PostAsJsonAsync("/api/account/sign-up", new { name = "Grace O.", email, password = "a-different-passphrase" });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain(await ProfilesOf(email), p => p.OrganisationId == northside.Id);
        var link = VerificationLink(email);
        Assert.StartsWith($"{northside.Origin}/verify-email?", link);

        Assert.Equal(HttpStatusCode.OK, (await Confirm(On(northside), link)).StatusCode);

        Assert.Contains((northside.Id, "Grace O."), await ProfilesOf(email));
        Assert.Equal(2, (await ProfilesOf(email)).Count);
    }

    [Fact]
    public async Task A_changed_name_on_the_link_joins_nothing()
    {
        var northside = await factory.AddOrganisationAsync();
        var email = UniqueEmail();
        await factory.CreateClient().PostAsJsonAsync("/api/account/sign-up", new { name = "Grace Okonkwo", email, password = Password });
        factory.Emails.Sent.Clear();
        await On(northside).PostAsJsonAsync("/api/account/sign-up", new { name = "Grace O.", email, password = Password });

        var tampered = VerificationLink(email).Replace("name=Grace%20O.", "name=Mallory", StringComparison.Ordinal);
        var response = await Confirm(On(northside), tampered);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain(await ProfilesOf(email), p => p.OrganisationId == northside.Id);
    }

    [Fact]
    public async Task A_member_signing_up_again_on_their_own_host_is_sent_nothing()
    {
        var email = UniqueEmail();
        await factory.CreateClient().PostAsJsonAsync("/api/account/sign-up", new { name = "Grace Okonkwo", email, password = Password });
        factory.Emails.Sent.Clear();

        var response = await factory.CreateClient().PostAsJsonAsync("/api/account/sign-up", new { name = "Grace", email, password = Password });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(factory.Emails.SentTo(email));
        Assert.Single(await ProfilesOf(email));
    }

    // Traces to: L2-132 AC2. The invite belongs to the inviter's organisation and its link carries that host.
    [Fact]
    public async Task A_member_elsewhere_accepting_an_invite_gets_a_profile_in_the_inviters_organisation()
    {
        var northside = await factory.AddOrganisationAsync();
        var inviter = await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead);
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = await factory.WithDbAsync(db => db.Users.Where(u => u.Id == grace.UserId).Select(u => u.Email!).SingleAsync());
        var (invite, token) = await AddInviteAsync(northside, inviter, email, Role.Volunteer);

        var response = await factory.ClientOn(northside, grace).PostAsJsonAsync("/api/invites/accept", new { Token = token });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var joined = await factory.WithDbAsync(northside.Id, db => db.Profiles.AsNoTracking().SingleAsync(p => p.UserId == grace.UserId));
        Assert.Equal("Grace Okonkwo", joined.Name);
        Assert.Equal([Role.Volunteer], joined.Roles.Select(r => r.Role));
        Assert.Equal(joined.Id, (await factory.WithDbAsync(northside.Id, db => db.Invites.AsNoTracking().SingleAsync(i => i.Id == invite.Id))).AcceptedBy);
        Assert.Equal(2, (await ProfilesOf(email)).Count);
    }

    [Fact]
    public async Task An_account_that_already_has_a_profile_there_is_linked_not_duplicated()
    {
        var northside = await factory.AddOrganisationAsync();
        var inviter = await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead);
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var there = await factory.AddMembershipAsync(northside, grace.UserId, "Grace O.");
        var email = await factory.WithDbAsync(db => db.Users.Where(u => u.Id == grace.UserId).Select(u => u.Email!).SingleAsync());
        var (invite, token) = await AddInviteAsync(northside, inviter, email, Role.Volunteer);

        var response = await factory.ClientOn(northside, there).PostAsJsonAsync("/api/invites/accept", new { Token = token });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(there.ProfileId, (await factory.WithDbAsync(northside.Id, db => db.Invites.AsNoTracking().SingleAsync(i => i.Id == invite.Id))).AcceptedBy);
        Assert.Equal(2, (await ProfilesOf(email)).Count);
    }

    [Fact]
    public async Task A_new_account_from_an_invite_is_a_member_of_the_inviters_organisation_only()
    {
        var northside = await factory.AddOrganisationAsync();
        var inviter = await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead);
        var email = UniqueEmail();
        var (_, token) = await AddInviteAsync(northside, inviter, email, null);

        var response = await On(northside).PostAsJsonAsync("/api/invites/accept", new { Token = token, Name = "Ruth Alvarez", Password });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal([(northside.Id, "Ruth Alvarez")], await ProfilesOf(email));
    }

    // Traces to: L2-132 AC2, ADR 0022. A connect link belongs to its owner's organisation; the contact it makes is there.
    [Fact]
    public async Task A_member_elsewhere_opening_a_connect_link_joins_the_owners_organisation_and_is_connected_there()
    {
        var northside = await factory.AddOrganisationAsync();
        var lead = await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead);
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var link = await factory.ClientOn(northside, lead).GetFromJsonAsync<ConnectLink>("/api/connect/link");
        var token = ConnectClients.TokenFrom(link!.Url);

        var response = await factory.ClientOn(northside, grace).PostAsJsonAsync("/api/connect", new { token });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var joined = await factory.WithDbAsync(northside.Id, db => db.Profiles.AsNoTracking().SingleAsync(p => p.UserId == grace.UserId));
        Assert.Equal("Grace Okonkwo", joined.Name);
        var contact = Assert.Single(await factory.WithDbAsync(northside.Id, db => db.Contacts.AsNoTracking().Where(c => c.OwnerId == lead.ProfileId).ToListAsync()));
        Assert.Equal(joined.Id, contact.LinkedProfileId);
        Assert.False(await factory.WithDbAsync(db => db.Contacts.AnyAsync(c => c.LinkedProfileId == joined.Id)));
    }

    [Fact]
    public async Task Signing_up_through_a_connect_link_creates_the_profile_in_the_owners_organisation()
    {
        var northside = await factory.AddOrganisationAsync();
        var lead = await factory.AddMemberAsync(northside, "Ana Lima", Role.CityLead);
        var link = await factory.ClientOn(northside, lead).GetFromJsonAsync<ConnectLink>("/api/connect/link");
        var email = UniqueEmail();

        var response = await On(northside).PostAsJsonAsync("/api/connect/sign-up",
            new { token = ConnectClients.TokenFrom(link!.Url), name = "Tomás Ortega", email, password = Password });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var profiles = await ProfilesOf(email);
        Assert.Equal([(northside.Id, "Tomás Ortega")], profiles);
        Assert.StartsWith($"{northside.Origin}/verify-email?", VerificationLink(email));
    }

    private sealed record ConnectLink(string Url);

    private async Task<(Invite Invite, string Token)> AddInviteAsync(
        OrganisationScopes.OtherOrganisation organisation, ProfileClients.Member inviter, string email, Role? role)
    {
        var token = Guid.NewGuid().ToString("N");
        var invite = new Invite(email, InviteClients.Hash(token), role, inviter.ProfileId, factory.Time.GetUtcNow());
        await factory.WithDbAsync(organisation.Id, async db =>
        {
            db.Invites.Add(invite);
            return await db.SaveChangesAsync();
        });
        return (invite, token);
    }

    private HttpClient On(OrganisationScopes.OtherOrganisation organisation)
    {
        var client = factory.CreateClient();
        client.BaseAddress = new Uri(organisation.Origin);
        return client;
    }

    private string VerificationLink(string email) =>
        Regex.Match(Assert.Single(factory.Emails.SentTo(email)).Body, @"https://\S+/verify-email\?\S+").Value;

    private static Task<HttpResponseMessage> Confirm(HttpClient client, string link)
    {
        var query = HttpUtility.ParseQueryString(new Uri(link).Query);
        return client.PostAsJsonAsync("/api/account/verify-email", new
        {
            userId = query["userId"],
            token = query["token"],
            name = query["name"],
            join = query["join"],
        });
    }

    private Task<List<(Guid OrganisationId, string Name)>> ProfilesOf(string email) =>
        factory.WithDbAsync(async db =>
        {
            var user = await db.Users.SingleAsync(u => u.Email == email);
            return (await db.Profiles.IgnoreQueryFilters().Where(p => p.UserId == user.Id).ToListAsync())
                .Select(p => (p.OrganisationId, p.Name)).ToList();
        });

    private static string UniqueEmail() => $"{Guid.NewGuid():N}@example.org";
}
