using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Identity;

public class SignInTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private readonly OidcFlow _flow = new(factory);

    [Fact]
    public async Task Verified_account_signs_in_with_code_and_pkce_and_can_call_the_api()
    {
        var email = await _flow.CreateAccountAsync();

        var tokens = await _flow.SignInAndGetTokensAsync(email);

        Assert.InRange(tokens.ExpiresIn, 15 * 60 - 5, 15 * 60);
        Assert.False(string.IsNullOrEmpty(tokens.RefreshToken));
        var me = await _flow.Api(tokens.AccessToken).GetFromJsonAsync<JsonElement>("/api/me");
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.True(me.GetProperty("emailVerified").GetBoolean());
    }

    [Fact]
    public async Task Authorize_without_a_session_redirects_to_the_sign_in_page_with_the_return_url()
    {
        var response = await _flow.Browser.GetAsync(OidcFlow.AuthorizeUrl("challenge"));

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!.ToString();
        Assert.StartsWith($"{CommunityApiFactory.WebAppOrigin}/sign-in?returnUrl=", location);
        Assert.Contains(Uri.EscapeDataString("/connect/authorize?"), location);
    }

    [Fact]
    public async Task Unverified_account_can_sign_in_and_is_reported_unverified()
    {
        var email = await _flow.CreateAccountAsync(verified: false);

        var tokens = await _flow.SignInAndGetTokensAsync(email);

        var me = await _flow.Api(tokens.AccessToken).GetFromJsonAsync<JsonElement>("/api/me");
        Assert.False(me.GetProperty("emailVerified").GetBoolean());
    }

    [Fact]
    public async Task Me_reflects_email_verification_without_signing_in_again()
    {
        var email = await _flow.CreateAccountAsync(verified: false);
        var api = _flow.Api((await _flow.SignInAndGetTokensAsync(email)).AccessToken);

        await factory.WithDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Email == email)).EmailConfirmed = true;
            return await db.SaveChangesAsync();
        });

        var me = await api.GetFromJsonAsync<JsonElement>("/api/me");
        Assert.True(me.GetProperty("emailVerified").GetBoolean());
        Assert.Equal("Signer", me.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Wrong_password_and_unknown_email_get_the_same_generic_error()
    {
        var email = await _flow.CreateAccountAsync();

        var wrongPassword = await _flow.SignInAsync(email, "not-the-right-password");
        var unknownEmail = await _flow.SignInAsync($"{Guid.NewGuid():N}@example.com");

        await AssertSignInError(wrongPassword, "invalid_credentials");
        await AssertSignInError(unknownEmail, "invalid_credentials");
    }

    [Fact]
    public async Task Sixth_attempt_after_five_failures_is_locked_out_even_with_the_right_password()
    {
        var email = await _flow.CreateAccountAsync();
        for (var i = 0; i < 5; i++)
        {
            await _flow.SignInAsync(email, "not-the-right-password");
        }

        await AssertSignInError(await _flow.SignInAsync(email), "locked_out");
    }

    [Fact]
    public async Task Suspended_account_is_refused()
    {
        var email = await _flow.CreateAccountAsync();
        await factory.WithDbAsync(async db =>
        {
            var profileId = await db.Users.Where(u => u.Email == email).Select(u => u.ProfileId).SingleAsync();
            (await db.Profiles.SingleAsync(p => p.Id == profileId)).Suspend();
            return await db.SaveChangesAsync();
        });

        await AssertSignInError(await _flow.SignInAsync(email), "suspended");
    }

    [Fact]
    public async Task Token_request_without_a_valid_code_verifier_is_rejected()
    {
        var email = await _flow.CreateAccountAsync();
        (await _flow.SignInAsync(email)).EnsureSuccessStatusCode();
        var verifier = OidcFlow.NewCodeVerifier();

        var missing = await _flow.ExchangeCodeAsync(await _flow.AuthorizeAsync(verifier), null);
        var wrong = await _flow.ExchangeCodeAsync(await _flow.AuthorizeAsync(verifier), OidcFlow.NewCodeVerifier());

        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal("invalid_grant", (await wrong.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString());
    }

    [Fact]
    public async Task Refresh_token_issues_a_new_access_token()
    {
        var tokens = await _flow.SignInAndGetTokensAsync(await _flow.CreateAccountAsync());

        var response = await _flow.RefreshAsync(tokens.RefreshToken);

        response.EnsureSuccessStatusCode();
        var refreshed = (await response.Content.ReadFromJsonAsync<TokenResponse>())!;
        Assert.Equal(HttpStatusCode.OK, (await _flow.Api(refreshed.AccessToken).GetAsync("/api/me")).StatusCode);
    }

    [Fact]
    public async Task Sign_out_revokes_the_tokens()
    {
        var tokens = await _flow.SignInAndGetTokensAsync(await _flow.CreateAccountAsync());
        var api = _flow.Api(tokens.AccessToken);

        var response = await api.PostAsync("/api/account/sign-out", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _flow.RefreshAsync(tokens.RefreshToken)).StatusCode);
    }

    private static async Task AssertSignInError(HttpResponseMessage response, string code)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(code, problem.GetProperty("code").GetString());
    }
}
