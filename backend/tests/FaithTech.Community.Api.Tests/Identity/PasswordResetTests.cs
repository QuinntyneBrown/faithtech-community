using System.Net;
using System.Net.Http.Json;
using System.Web;
using FaithTech.Community.Api.Tests.Fakes;
using Microsoft.AspNetCore.Mvc;

namespace FaithTech.Community.Api.Tests.Identity;

public class PasswordResetTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string NewPassword = "a-brand-new-passphrase";
    private readonly OidcFlow _flow = new(factory);

    [Fact]
    public async Task Request_gets_the_same_response_for_any_email_and_mails_only_existing_accounts()
    {
        var existing = await _flow.CreateAccountAsync();
        var unknown = $"{Guid.NewGuid():N}@example.com";

        var forExisting = await RequestReset(existing);
        var forUnknown = await RequestReset(unknown);

        Assert.Equal(HttpStatusCode.Accepted, forExisting.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, forUnknown.StatusCode);
        Assert.Contains(factory.Emails.SentTo(existing), m => m.Body.Contains($"{CommunityApiFactory.WebAppOrigin}/reset-password?"));
        Assert.Empty(factory.Emails.SentTo(unknown));
    }

    [Fact]
    public async Task Valid_link_changes_the_password_and_revokes_every_session()
    {
        var email = await _flow.CreateAccountAsync();
        var tokens = await _flow.SignInAndGetTokensAsync(email);
        var link = await RequestAndGetLink(email);

        var response = await Reset(link, NewPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _flow.Api(tokens.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _flow.RefreshAsync(tokens.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _flow.SignInAsync(email, OidcFlow.Password)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _flow.SignInAsync(email, NewPassword)).StatusCode);
    }

    [Fact]
    public async Task Reset_clears_a_lockout_and_the_failures_that_led_to_it()
    {
        var email = await _flow.CreateAccountAsync();
        for (var i = 0; i < 5; i++)
        {
            await _flow.SignInAsync(email, "not-the-right-password");
        }

        await Reset(await RequestAndGetLink(email), NewPassword);
        for (var i = 0; i < 4; i++)
        {
            await _flow.SignInAsync(email, "not-the-right-password");
        }

        Assert.Equal(HttpStatusCode.OK, (await _flow.SignInAsync(email, NewPassword)).StatusCode);
    }

    [Fact]
    public async Task Already_used_link_is_rejected_with_a_token_error()
    {
        var link = await RequestAndGetLink(await _flow.CreateAccountAsync());
        await Reset(link, NewPassword);

        await AssertErrorOn("Token", await Reset(link, "yet-another-passphrase"));
    }

    [Fact]
    public async Task Link_older_than_an_hour_is_rejected_with_a_token_error()
    {
        var link = await RequestAndGetLink(await _flow.CreateAccountAsync());
        factory.Time.Advance(TimeSpan.FromHours(1) + TimeSpan.FromMinutes(1));

        await AssertErrorOn("Token", await Reset(link, NewPassword));
    }

    [Theory]
    [InlineData("short-pass1")]
    [InlineData(FakeBreachedPasswordChecker.BreachedPassword)]
    public async Task Weak_new_password_is_rejected_on_the_password_field(string password)
    {
        var link = await RequestAndGetLink(await _flow.CreateAccountAsync());

        await AssertErrorOn("Password", await Reset(link, password));
    }

    private Task<HttpResponseMessage> RequestReset(string email) =>
        factory.CreateClient().PostAsJsonAsync("/api/account/forgot-password", new { email });

    private async Task<ResetLink> RequestAndGetLink(string email)
    {
        (await RequestReset(email)).EnsureSuccessStatusCode();
        var body = factory.Emails.SentTo(email).Last().Body;
        var url = new Uri(body.Split('\n').Single(l => l.StartsWith(CommunityApiFactory.WebAppOrigin)));
        var query = HttpUtility.ParseQueryString(url.Query);
        return new ResetLink(Guid.Parse(query["userId"]!), query["token"]!);
    }

    private Task<HttpResponseMessage> Reset(ResetLink link, string password) =>
        factory.CreateClient().PostAsJsonAsync("/api/account/reset-password", new { link.UserId, link.Token, password });

    private static async Task AssertErrorOn(string field, HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal([field], problem!.Errors.Keys);
    }

    private sealed record ResetLink(Guid UserId, string Token);
}
