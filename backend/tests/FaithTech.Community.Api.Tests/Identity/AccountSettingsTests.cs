// Traces to: L2-052
using System.Net;
using System.Net.Http.Json;
using System.Web;
using FaithTech.Community.Api.Tests.Fakes;
using Microsoft.AspNetCore.Mvc;

namespace FaithTech.Community.Api.Tests.Identity;

public class AccountSettingsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string NewPassword = "a-brand-new-passphrase";
    private readonly OidcFlow _flow = new(factory);

    private sealed record Account(string Email, bool HasPassword);

    private sealed record Updated(string? PendingEmail, bool PasswordChanged);

    private sealed record ChangeLink(Guid UserId, string Email, string Token);

    [Fact]
    public async Task A_member_reads_their_own_sign_in_email()
    {
        var (email, api) = await SignedInAsync();

        var account = await api.GetFromJsonAsync<Account>("/api/account");

        Assert.Equal(new Account(email, true), account);
    }

    // AC1: Given a signed-in user, when they change their email, then the new address must be verified before it
    // replaces the old one.
    [Fact]
    public async Task A_new_email_is_verified_by_a_link_before_it_replaces_the_old_one()
    {
        var (email, api) = await SignedInAsync();
        var newEmail = $"{Guid.NewGuid():N}@example.org";

        var response = await api.PutAsJsonAsync("/api/account", new { Email = newEmail });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new Updated(newEmail, false), await response.Content.ReadFromJsonAsync<Updated>());
        Assert.Equal(email, (await api.GetFromJsonAsync<Account>("/api/account"))!.Email);
        Assert.Equal(HttpStatusCode.OK, (await _flow.SignInAsync(email)).StatusCode);

        var link = LinkSentTo(newEmail);
        var confirmed = await factory.CreateClient().PostAsJsonAsync("/api/account/confirm-email-change", link);

        Assert.Equal(HttpStatusCode.NoContent, confirmed.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _flow.SignInAsync(newEmail)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _flow.SignInAsync(email)).StatusCode);
    }

    [Fact]
    public async Task A_used_email_change_link_is_refused()
    {
        var (_, api) = await SignedInAsync();
        var newEmail = $"{Guid.NewGuid():N}@example.org";
        await api.PutAsJsonAsync("/api/account", new { Email = newEmail });
        var link = LinkSentTo(newEmail);
        await factory.CreateClient().PostAsJsonAsync("/api/account/confirm-email-change", link);

        var again = await factory.CreateClient().PostAsJsonAsync("/api/account/confirm-email-change", link);

        await AssertErrorAsync(again, "Token", "This link has expired or has already been used.");
    }

    [Fact]
    public async Task An_email_another_account_uses_is_refused_on_the_email_field()
    {
        var (_, api) = await SignedInAsync();
        var other = await _flow.CreateAccountAsync();

        var response = await api.PutAsJsonAsync("/api/account", new { Email = other });

        await AssertErrorAsync(response, "Email", "Another account uses that email.");
        Assert.DoesNotContain(factory.Emails.SentTo(other), m => m.Body.Contains("email="));
    }

    // AC2: Given a signed-in user, when they change their password, then the current password is required, and the
    // new one follows L2-001.3.
    [Fact]
    public async Task Changing_the_password_needs_the_current_one()
    {
        var (email, api) = await SignedInAsync();

        var response = await api.PutAsJsonAsync("/api/account", new { Email = email, NewPassword });

        await AssertErrorAsync(response, "CurrentPassword", "Enter your current password to change it.");
    }

    [Fact]
    public async Task A_wrong_current_password_is_refused_on_its_field()
    {
        var (email, api) = await SignedInAsync();

        var response = await api.PutAsJsonAsync("/api/account", new { Email = email, CurrentPassword = "not-the-password", NewPassword });

        await AssertErrorAsync(response, "CurrentPassword", "Your current password is incorrect.");
        Assert.Equal(HttpStatusCode.OK, (await _flow.SignInAsync(email)).StatusCode);
    }

    [Theory]
    [InlineData("short-pass1", "Use at least 12 characters.")]
    [InlineData(FakeBreachedPasswordChecker.BreachedPassword, "This password has appeared in a data breach. Choose a different one.")]
    public async Task A_new_password_follows_the_sign_up_rules(string password, string message)
    {
        var (email, api) = await SignedInAsync();

        var response = await api.PutAsJsonAsync("/api/account", new { Email = email, CurrentPassword = OidcFlow.Password, NewPassword = password });

        await AssertErrorAsync(response, "NewPassword", message);
    }

    [Fact]
    public async Task With_the_current_password_the_new_one_replaces_it()
    {
        var (email, api) = await SignedInAsync();

        var response = await api.PutAsJsonAsync("/api/account", new { Email = email, CurrentPassword = OidcFlow.Password, NewPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new Updated(null, true), await response.Content.ReadFromJsonAsync<Updated>());
        Assert.Equal(HttpStatusCode.BadRequest, (await _flow.SignInAsync(email)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _flow.SignInAsync(email, NewPassword)).StatusCode);
    }

    // AC3: only when they confirm is every session and refresh token for the account revoked.
    [Fact]
    public async Task Signing_out_everywhere_revokes_every_session_and_refresh_token()
    {
        var email = await _flow.CreateAccountAsync();
        var phone = await _flow.SignInAndGetTokensAsync(email);
        var laptop = await _flow.SignInAndGetTokensAsync(email);

        var response = await _flow.Api(laptop.AccessToken).PostAsync("/api/account/sign-out-everywhere", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _flow.Api(phone.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _flow.Api(laptop.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _flow.RefreshAsync(phone.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _flow.SignInAsync(email)).StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/account")]
    [InlineData("PUT", "/api/account")]
    [InlineData("POST", "/api/account/sign-out-everywhere")]
    public async Task Account_settings_need_a_signed_in_member(string method, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path) { Content = JsonContent.Create(new { Email = "a@example.org" }) };

        var response = await factory.CreateClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<(string Email, HttpClient Api)> SignedInAsync()
    {
        var email = await _flow.CreateAccountAsync();
        var tokens = await _flow.SignInAndGetTokensAsync(email);
        return (email, _flow.Api(tokens.AccessToken));
    }

    private ChangeLink LinkSentTo(string address)
    {
        var body = factory.Emails.SentTo(address).Last().Body;
        var url = new Uri(body.Split('\n').Single(l => l.StartsWith(CommunityApiFactory.WebAppOrigin)));
        var query = HttpUtility.ParseQueryString(url.Query);
        Assert.Equal("/verify-email", url.AbsolutePath);
        return new ChangeLink(Guid.Parse(query["userId"]!), query["email"]!, query["token"]!);
    }

    private static async Task AssertErrorAsync(HttpResponseMessage response, string field, string message)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal([message], problem!.Errors[field]);
    }
}
