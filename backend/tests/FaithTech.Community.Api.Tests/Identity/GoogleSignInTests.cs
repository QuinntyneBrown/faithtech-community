// Traces to: L2-078, L2-079
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Web;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FaithTech.Community.Api.Tests.Contacts.ContactClients;

namespace FaithTech.Community.Api.Tests.Identity;

public class GoogleSignInTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string Failed = $"{CommunityApiFactory.MarketingOrigin}/?google=failed";
    private const string Suspended = $"{CommunityApiFactory.MarketingOrigin}/?google=suspended";

    private readonly OidcFlow _flow = new(factory);

    [Fact]
    public async Task Start_sends_the_browser_to_Google_with_a_state_and_nonce_kept_in_a_protected_cookie()
    {
        var response = await _flow.Browser.GetAsync("/api/account/google/start?returnUrl=%2Fevents&keepSignedIn=true");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!;
        Assert.StartsWith(FakeGoogleIdentityProvider.AuthorizationEndpoint, location.ToString());
        var (state, nonce) = FakeGoogleIdentityProvider.ReadAuthorizationUrl(location);
        Assert.True(state.Length >= 32 && nonce.Length >= 32 && state != nonce);
        Assert.Equal($"{CommunityApiFactory.WebAppOrigin}/api/account/google/callback", HttpUtility.ParseQueryString(location.Query)["redirect_uri"]);
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("ftc.google="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(state, cookie);
    }

    [Fact]
    public async Task A_new_Google_account_creates_an_account_with_no_role_a_verified_email_and_no_password()
    {
        var email = NewEmail();

        var landing = await SignInWithGoogleAsync(Identity(email, name: "Leah Thompson"), "/events", keepSignedIn: true);

        Assert.Equal($"{CommunityApiFactory.WebAppOrigin}/auth/continue?returnUrl=%2Fevents&keepSignedIn=1", landing);
        var me = await MeAfterPkceAsync();
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.Equal("Leah Thompson", me.GetProperty("name").GetString());
        Assert.True(me.GetProperty("emailVerified").GetBoolean());
        Assert.Empty(me.GetProperty("roles").EnumerateArray());
        var user = await factory.WithDbAsync(db => db.Users.SingleAsync(u => u.Email == email));
        Assert.Null(user.PasswordHash);
        Assert.True(await factory.WithDbAsync(db => db.UserLogins.AnyAsync(l => l.UserId == user.Id && l.LoginProvider == "Google")));
    }

    // Traces to: L2-100 AC1 (docs/detailed-designs/reports/reports-dashboard): a new Google account records the
    // join time.
    [Fact]
    public async Task A_new_Google_account_records_the_join_time()
    {
        var email = NewEmail();

        await SignInWithGoogleAsync(Identity(email, name: "Leah Thompson"));

        var user = await factory.WithDbAsync(db => db.Users.SingleAsync(u => u.Email == email));
        var profile = await factory.WithDbAsync(db => db.Profiles.SingleAsync(p => p.Id == user.ProfileId));
        Assert.Equal(factory.Time.GetUtcNow().UtcDateTime, profile.JoinedAtUtc);
    }

    [Fact]
    public async Task A_verified_matching_email_signs_into_the_existing_account_and_links_Google_to_it()
    {
        var email = await _flow.CreateAccountAsync();
        var google = Identity(email);

        await SignInWithGoogleAsync(google);
        var first = await MeAfterPkceAsync();
        // Google keeps the same subject even when the person changes their Gmail address.
        await SignInWithGoogleAsync(google with { Email = NewEmail() });
        var second = await MeAfterPkceAsync();

        Assert.Equal(email, first.GetProperty("email").GetString());
        Assert.Equal(first.GetProperty("id").GetString(), second.GetProperty("id").GetString());
        Assert.Equal(1, await factory.WithDbAsync(db => db.Users.CountAsync(u => u.Email == email)));
    }

    [Fact]
    public async Task Linking_an_unverified_account_verifies_it_and_removes_the_unproven_password()
    {
        var email = await _flow.CreateAccountAsync(verified: false);

        await SignInWithGoogleAsync(Identity(email));

        var user = await factory.WithDbAsync(db => db.Users.SingleAsync(u => u.Email == email));
        Assert.True(user.EmailConfirmed);
        Assert.Null(user.PasswordHash);
        var withOldPassword = await new OidcFlow(factory).SignInAsync(email);
        Assert.Equal(HttpStatusCode.BadRequest, withOldPassword.StatusCode);
    }

    [Fact]
    public async Task An_unverified_Google_email_is_refused_and_nothing_is_created()
    {
        var email = NewEmail();

        var landing = await SignInWithGoogleAsync(Identity(email, verified: false));

        Assert.Equal(Failed, landing);
        Assert.False(await factory.WithDbAsync(db => db.Users.AnyAsync(u => u.Email == email)));
        await AssertNoSessionAsync();
    }

    [Fact]
    public async Task A_suspended_account_is_refused_with_the_same_outcome_as_password_sign_in()
    {
        var email = await _flow.CreateAccountAsync();
        await factory.WithDbAsync(async db =>
        {
            var profileId = await db.Users.Where(u => u.Email == email).Select(u => u.ProfileId).SingleAsync();
            (await db.Profiles.SingleAsync(p => p.Id == profileId)).Suspend("Misuse", DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });

        var landing = await SignInWithGoogleAsync(Identity(email));

        Assert.Equal(Suspended, landing);
        await AssertNoSessionAsync();
    }

    [Fact]
    public async Task A_callback_whose_state_does_not_match_is_refused()
    {
        var (_, nonce) = await StartAsync();
        var code = factory.Google.IssueCode(Identity(NewEmail()), nonce);

        var response = await _flow.Browser.GetAsync($"/api/account/google/callback?code={code}&state=forged");

        Assert.Equal(Failed, response.Headers.Location!.ToString());
        await AssertNoSessionAsync();
    }

    [Fact]
    public async Task A_replayed_callback_is_refused()
    {
        var (state, nonce) = await StartAsync();
        var email = NewEmail();
        var callback = $"/api/account/google/callback?code={factory.Google.IssueCode(Identity(email), nonce)}&state={Uri.EscapeDataString(state)}";
        await _flow.Browser.GetAsync(callback);
        var attacker = new OidcFlow(factory);

        var replay = await attacker.Browser.GetAsync(callback);

        Assert.Equal(Failed, replay.Headers.Location!.ToString());
        var authorize = await attacker.Browser.GetAsync(OidcFlow.AuthorizeUrl("challenge"));
        Assert.StartsWith($"{CommunityApiFactory.WebAppOrigin}/sign-in", authorize.Headers.Location!.ToString());
    }

    [Fact]
    public async Task A_token_that_fails_validation_is_refused()
    {
        var (state, _) = await StartAsync();
        // Google issued this code for another sign-in's nonce, so its ID token does not validate here.
        var code = factory.Google.IssueCode(Identity(NewEmail()), "another-nonce");

        var response = await _flow.Browser.GetAsync($"/api/account/google/callback?code={code}&state={Uri.EscapeDataString(state)}");

        Assert.Equal(Failed, response.Headers.Location!.ToString());
        await AssertNoSessionAsync();
    }

    [Fact]
    public async Task Google_refusing_consent_returns_the_visitor_to_the_marketing_page()
    {
        var (state, _) = await StartAsync();

        var response = await _flow.Browser.GetAsync($"/api/account/google/callback?error=access_denied&state={Uri.EscapeDataString(state)}");

        Assert.Equal(Failed, response.Headers.Location!.ToString());
    }

    [Fact]
    public async Task Without_Google_configuration_the_button_returns_the_visitor_with_the_failure()
    {
        var unconfigured = new FakeGoogleIdentityProvider { Configured = false };
        var client = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<IGoogleIdentityProvider>(unconfigured)))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost") });

        var response = await client.GetAsync("/api/account/google/start");

        Assert.Equal(Failed, response.Headers.Location!.ToString());
    }

    [Fact]
    public async Task A_return_url_outside_the_community_app_lands_on_home()
    {
        var landing = await SignInWithGoogleAsync(Identity(NewEmail()), "https://evil.example/steal");

        Assert.Equal($"{CommunityApiFactory.WebAppOrigin}/auth/continue?returnUrl=%2F&keepSignedIn=0", landing);
    }

    [Fact]
    public async Task A_new_Google_account_matches_private_contacts_with_that_email()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var email = NewEmail();
        await factory.CreateContactAsync(grace, "Tomás Ortega", email);

        await SignInWithGoogleAsync(Identity(email, name: "Tomás Ortega"));

        Assert.True(await factory.WithDbAsync(db => db.Notifications.AnyAsync(n => n.RecipientId == grace.ProfileId && n.Kind == NotificationKind.ContactSignedUp)));
    }

    [Fact]
    public async Task The_21st_Google_request_in_a_minute_from_one_address_returns_429()
    {
        var client = factory.WithWebHostBuilder(b => b.UseSetting("RateLimits:AuthPerMinute", "20"))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost") });

        for (var i = 0; i < 20; i++)
        {
            Assert.Equal(HttpStatusCode.Redirect, (await client.GetAsync("/api/account/google/start")).StatusCode);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.GetAsync("/api/account/google/callback?code=x&state=y")).StatusCode);
    }

    private static string NewEmail() => $"{Guid.NewGuid():N}@gmail.example";

    private static GoogleIdentity Identity(string email, bool verified = true, string? name = "Google Person") =>
        new(Guid.NewGuid().ToString("N"), email, verified, name);

    private async Task<(string State, string Nonce)> StartAsync(string? returnUrl = null, bool keepSignedIn = false)
    {
        var query = $"keepSignedIn={(keepSignedIn ? "true" : "false")}" + (returnUrl is null ? string.Empty : $"&returnUrl={Uri.EscapeDataString(returnUrl)}");
        var response = await _flow.Browser.GetAsync($"/api/account/google/start?{query}");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        return FakeGoogleIdentityProvider.ReadAuthorizationUrl(response.Headers.Location!);
    }

    /// <summary>Start, consent at "Google" and return to the callback; answers where the browser is sent.</summary>
    private async Task<string> SignInWithGoogleAsync(GoogleIdentity identity, string? returnUrl = null, bool keepSignedIn = false)
    {
        var (state, nonce) = await StartAsync(returnUrl, keepSignedIn);
        var code = factory.Google.IssueCode(identity, nonce);
        var response = await _flow.Browser.GetAsync($"/api/account/google/callback?code={code}&state={Uri.EscapeDataString(state)}");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        return response.Headers.Location!.ToString();
    }

    /// <summary>What the community app's /auth/continue does next: authorization code + PKCE, then /api/me.</summary>
    private async Task<JsonElement> MeAfterPkceAsync()
    {
        var verifier = OidcFlow.NewCodeVerifier();
        var tokens = await (await _flow.ExchangeCodeAsync(await _flow.AuthorizeAsync(verifier), verifier)).Content.ReadFromJsonAsync<TokenResponse>();
        return await _flow.Api(tokens!.AccessToken).GetFromJsonAsync<JsonElement>("/api/me");
    }

    private async Task AssertNoSessionAsync()
    {
        var authorize = await _flow.Browser.GetAsync(OidcFlow.AuthorizeUrl("challenge"));
        Assert.StartsWith($"{CommunityApiFactory.WebAppOrigin}/sign-in", authorize.Headers.Location!.ToString());
    }
}
