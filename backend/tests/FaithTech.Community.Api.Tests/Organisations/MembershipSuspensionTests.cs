using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-132 AC5, L2-039, L2-003 AC4. Suspension is of a membership: it signs the account out of that
// organisation only and refuses sign-in on its host, while the account carries on in its other organisations.
public class MembershipSuspensionTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Suspending_a_membership_revokes_only_that_organisations_sessions()
    {
        var (northside, email, userId) = await AccountInBothAsync();
        var faithtechTokens = await new OidcFlow(factory).SignInAndGetTokensAsync(email);
        var there = new OidcFlow(factory, northside.Origin);
        var northsideTokens = await there.SignInAndGetTokensAsync(email);

        Assert.Equal(HttpStatusCode.NoContent, (await SuspendAsync(northside, userId)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await there.Api(northsideTokens.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await there.RefreshAsync(northsideTokens.RefreshToken)).StatusCode);
        var here = new OidcFlow(factory);
        Assert.Equal(HttpStatusCode.OK, (await here.Api(faithtechTokens.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await here.RefreshAsync(faithtechTokens.RefreshToken)).StatusCode);
    }

    [Fact]
    public async Task A_suspended_membership_refuses_sign_in_on_its_host_only()
    {
        var (northside, email, userId) = await AccountInBothAsync();
        await SuspendAsync(northside, userId);

        var refused = await new OidcFlow(factory, northside.Origin).SignInAsync(email);
        var accepted = await new OidcFlow(factory).SignInAsync(email);

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        var problem = await refused.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("suspended", problem.GetProperty("code").GetString());
        Assert.Equal("Your membership of northside community is suspended.", problem.GetProperty("detail").GetString());
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
    }

    [Fact]
    public async Task Reinstating_restores_sign_in_on_that_host()
    {
        var (northside, email, userId) = await AccountInBothAsync();
        await SuspendAsync(northside, userId);
        var profileId = await factory.WithDbAsync(northside.Id, db => db.Profiles.Where(p => p.UserId == userId).Select(p => p.Id).SingleAsync());

        var response = await AdminOn(northside).DeleteAsync($"/api/admin/users/{profileId}/suspension");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await new OidcFlow(factory, northside.Origin).SignInAsync(email)).StatusCode);
    }

    private async Task<(OrganisationScopes.OtherOrganisation Northside, string Email, Guid UserId)> AccountInBothAsync()
    {
        var northside = await factory.AddOrganisationAsync();
        var email = await new OidcFlow(factory).CreateAccountAsync();
        var userId = await factory.WithDbAsync(db => db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync());
        await factory.AddMembershipAsync(northside, userId, "Grace O.");
        return (northside, email, userId);
    }

    private HttpClient AdminOn(OrganisationScopes.OtherOrganisation northside)
    {
        var admin = factory.AddMemberAsync(northside, "Ana Lima", Role.SystemAdmin).GetAwaiter().GetResult();
        return factory.ClientOn(northside, admin);
    }

    private async Task<HttpResponseMessage> SuspendAsync(OrganisationScopes.OtherOrganisation northside, Guid userId)
    {
        var profileId = await factory.WithDbAsync(northside.Id, db => db.Profiles.Where(p => p.UserId == userId).Select(p => p.Id).SingleAsync());
        return await AdminOn(northside).PostAsJsonAsync($"/api/admin/users/{profileId}/suspension", new { Reason = "Spam" });
    }
}
