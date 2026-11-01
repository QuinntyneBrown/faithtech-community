// Traces to: L2-078 (started on an organisation's host, completed on that organisation's community host), L2-132 AC7
using System.Net;
using System.Web;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Application.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Identity;

// Google sign-in on another organisation's community host returns to that host, never to FaithTech's.
public class GoogleSignInPerHostTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static GoogleIdentity Identity(string email) => new(Guid.NewGuid().ToString("N"), email, true, "Ana Lima");

    private static async Task<(string State, string Nonce, Uri Location)> StartAsync(HttpClient browser, string query)
    {
        var response = await browser.GetAsync($"/api/account/google/start?{query}");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var (state, nonce) = FakeGoogleIdentityProvider.ReadAuthorizationUrl(response.Headers.Location!);
        return (state, nonce, response.Headers.Location!);
    }

    [Fact]
    public async Task Sign_up_with_Google_on_another_organisations_host_calls_back_and_lands_there_as_its_member()
    {
        var slug = $"g{Guid.NewGuid():N}"[..20];
        var other = await factory.AddOrganisationAsync(slug);
        var browser = new OidcFlow(factory, other.Origin).Browser;
        var email = $"{Guid.NewGuid():N}@gmail.example";

        var (state, nonce, location) = await StartAsync(browser, "returnUrl=%2Fevents&keepSignedIn=true&signUp=true");
        Assert.Equal($"{other.Origin}/api/account/google/callback", HttpUtility.ParseQueryString(location.Query)["redirect_uri"]);
        var code = factory.Google.IssueCode(Identity(email), nonce);
        var callback = await browser.GetAsync($"/api/account/google/callback?code={code}&state={Uri.EscapeDataString(state)}");

        Assert.Equal($"{other.Origin}/auth/continue?returnUrl=%2Fevents&keepSignedIn=1", callback.Headers.Location!.ToString());
        var userId = await factory.WithDbAsync(db => db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync());
        Assert.True(await factory.WithDbAsync(other.Id, db => db.Profiles.AnyAsync(p => p.UserId == userId)));
    }

    [Fact]
    public async Task A_failed_Google_sign_in_returns_to_the_organisations_public_page()
    {
        var slug = $"g{Guid.NewGuid():N}"[..20];
        var app = factory.WithWebHostBuilder(b => b.UseSetting($"Marketing:Sites:www.{slug}.test:OrganisationSlug", slug));
        var other = await factory.AddOrganisationAsync(slug);
        var browser = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri(other.Origin) });

        var refused = await browser.GetAsync("/api/account/google/callback?code=x&state=y");

        Assert.Equal($"https://www.{slug}.test/?google=failed", refused.Headers.Location!.ToString());
    }

    [Fact]
    public async Task Without_a_public_page_a_failed_Google_sign_in_returns_to_the_organisations_sign_in()
    {
        var other = await factory.AddOrganisationAsync($"g{Guid.NewGuid():N}"[..20]);
        var browser = new OidcFlow(factory, other.Origin).Browser;

        var refused = await browser.GetAsync("/api/account/google/callback?code=x&state=y");

        Assert.Equal($"{other.Origin}/sign-in", refused.Headers.Location!.ToString());
    }
}
