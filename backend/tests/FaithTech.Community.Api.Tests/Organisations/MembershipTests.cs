using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Contacts;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-132 AC3, AC4 (ADR 0032). An account is global and a profile is its membership of one organisation:
// on a host, the caller is the profile they hold there, and a caller who holds none there is refused everywhere
// except the account endpoints, /connect, /api/site and /api/me, which says why and where they do belong.
public class MembershipTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Me(Guid ProfileId, string Name);

    public sealed record OrganisationName(string Name);

    public sealed record OtherMembership(string Name, string Host);

    public sealed record NotAMember(string Reason, OrganisationName Organisation, OtherMembership[] Memberships);

    [Fact]
    public async Task An_account_with_profiles_in_two_organisations_is_the_hosts_profile_on_each_host()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var northside = await factory.AddOrganisationAsync();
        var there = await factory.AddMembershipAsync(northside, grace.UserId, "Grace O.");

        Assert.Equal(new Me(grace.ProfileId, "Grace Okonkwo"), await factory.ClientFor(grace).GetFromJsonAsync<Me>("/api/me"));
        Assert.Equal(new Me(there.ProfileId, "Grace O."), await factory.ClientOn(northside, there).GetFromJsonAsync<Me>("/api/me"));
        Assert.Equal(HttpStatusCode.NotFound, (await factory.ClientOn(northside, there).GetAsync($"/api/profiles/{grace.ProfileId}")).StatusCode);
    }

    [Fact]
    public async Task One_accounts_contacts_and_roles_in_one_organisation_never_reach_another()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var northside = await factory.AddOrganisationAsync();
        var there = await factory.AddMembershipAsync(northside, grace.UserId, "Grace O.", Role.CityLead, Role.Volunteer);
        await factory.CreateContactAsync(grace, "Tomás Ortega");

        var client = factory.ClientOn(northside, there);

        Assert.DoesNotContain("Tomás Ortega", await client.GetStringAsync("/api/contacts"));
        Assert.Equal(["CityLead", "Volunteer"], (await client.GetFromJsonAsync<RolesOnly>("/api/me"))!.Roles.Order());
        Assert.Equal(["CityLead"], (await factory.ClientFor(grace).GetFromJsonAsync<RolesOnly>("/api/me"))!.Roles);
    }

    public sealed record RolesOnly(string[] Roles);

    [Fact]
    public async Task A_caller_with_no_profile_on_the_host_is_refused_every_feature()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var northside = await factory.AddOrganisationAsync();
        var client = factory.ClientOn(northside, grace);

        foreach (var path in new[] { "/api/events", "/api/people", "/api/contacts", "/api/notifications", $"/api/profiles/{grace.ProfileId}" })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(path)).StatusCode);
        }
    }

    [Fact]
    public async Task A_non_member_still_reaches_the_site_and_the_account_endpoints()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var northside = await factory.AddOrganisationAsync();
        var client = factory.ClientOn(northside, grace);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/site")).StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, (await client.PostAsync("/api/account/sign-out", null)).StatusCode);
    }

    [Fact]
    public async Task An_account_signs_in_on_a_host_where_it_has_no_profile_and_is_told_it_is_not_a_member()
    {
        // The account is global: sign-in succeeds, and only the app and the API refuse (L2-132 AC3).
        var northside = await factory.AddOrganisationAsync();
        var email = await new OidcFlow(factory).CreateAccountAsync();
        var there = new OidcFlow(factory, northside.Origin);

        var tokens = await there.SignInAndGetTokensAsync(email);

        var me = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        me.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        var response = await there.Browser.SendAsync(me);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("not-a-member", (await response.Content.ReadFromJsonAsync<NotAMember>())!.Reason);
    }

    [Fact]
    public async Task Me_tells_a_non_member_which_organisation_refused_them_and_where_they_belong()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var northside = await factory.AddOrganisationAsync();

        var response = await factory.ClientOn(northside, grace).GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<NotAMember>();
        Assert.Equal("not-a-member", body!.Reason);
        Assert.Equal("northside community", body.Organisation.Name);
        Assert.Equal([new OtherMembership("FaithTech Community", "app.faithtech.test")], body.Memberships);
    }

    [Fact]
    public async Task A_suspended_membership_counts_as_none()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var northside = await factory.AddOrganisationAsync();
        var there = await factory.AddMembershipAsync(northside, grace.UserId, "Grace O.");
        await factory.WithDbAsync(northside.Id, async db =>
        {
            (await db.Profiles.SingleAsync(p => p.Id == there.ProfileId)).Suspend("Spam", DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });

        var client = factory.ClientOn(northside, there);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/events")).StatusCode);
        var body = await (await client.GetAsync("/api/me")).Content.ReadFromJsonAsync<NotAMember>();
        Assert.Equal("not-a-member", body!.Reason);
        // FaithTech still lists only its own other memberships, never the suspended one.
        var fromFaithTech = await factory.ClientFor(grace).GetStringAsync("/api/me");
        Assert.DoesNotContain("northside", fromFaithTech);
    }
}
