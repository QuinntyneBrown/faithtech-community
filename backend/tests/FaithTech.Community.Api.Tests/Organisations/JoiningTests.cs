using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using System.Web;
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
