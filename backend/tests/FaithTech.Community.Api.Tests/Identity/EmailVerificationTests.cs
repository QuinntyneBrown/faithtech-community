using System.Net;
using System.Net.Http.Json;
using System.Web;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Identity;

public class EmailVerificationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Valid_link_marks_the_email_verified()
    {
        var (email, link) = await SignUpAndGetLink();

        var response = await Verify(link);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.Users.Where(u => u.Email == email).Select(u => u.EmailConfirmed).SingleAsync()));
    }

    [Fact]
    public async Task Already_used_link_is_rejected_with_a_token_error()
    {
        var (_, link) = await SignUpAndGetLink();
        await Verify(link);

        await AssertTokenError(await Verify(link));
    }

    [Fact]
    public async Task Link_older_than_24_hours_is_rejected_with_a_token_error()
    {
        var (_, link) = await SignUpAndGetLink();
        factory.Time.Advance(TimeSpan.FromHours(24) + TimeSpan.FromMinutes(1));

        await AssertTokenError(await Verify(link));
    }

    [Fact]
    public async Task Tampered_link_is_rejected_with_a_token_error()
    {
        var (_, link) = await SignUpAndGetLink();

        await AssertTokenError(await Verify(link with { Token = link.Token + "x" }));
        await AssertTokenError(await Verify(link with { UserId = Guid.NewGuid() }));
    }

    [Fact]
    public async Task Resend_sends_a_new_link_up_to_three_times_an_hour()
    {
        var (email, _) = await SignUpAndGetLink();
        var client = factory.CreateClient();

        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(HttpStatusCode.Accepted, (await Resend(client, email)).StatusCode);
        }

        var fourth = await Resend(client, email);
        Assert.Equal(HttpStatusCode.TooManyRequests, fourth.StatusCode);
        Assert.Contains("try again later", (await fourth.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(4, factory.Emails.SentTo(email).Count());

        factory.Time.Advance(TimeSpan.FromHours(1) + TimeSpan.FromMinutes(1));
        Assert.Equal(HttpStatusCode.Accepted, (await Resend(client, email)).StatusCode);
    }

    [Fact]
    public async Task Resend_for_an_unknown_email_looks_the_same_and_sends_nothing()
    {
        var email = $"{Guid.NewGuid():N}@example.com";

        var response = await Resend(factory.CreateClient(), email);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(factory.Emails.SentTo(email));
    }

    [Fact]
    public async Task Resend_for_a_verified_email_sends_nothing()
    {
        var (email, link) = await SignUpAndGetLink();
        await Verify(link);

        Assert.Equal(HttpStatusCode.Accepted, (await Resend(factory.CreateClient(), email)).StatusCode);
        Assert.Single(factory.Emails.SentTo(email));
    }

    private async Task<(string Email, VerificationLink Link)> SignUpAndGetLink()
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        await factory.CreateClient().PostAsJsonAsync("/api/account/sign-up",
            new { name = "Verifier", email, password = "a-long-enough-passphrase" });
        var body = factory.Emails.SentTo(email).Last().Body;
        var url = new Uri(body.Split('\n').Single(l => l.StartsWith(CommunityApiFactory.WebAppOrigin)));
        var query = HttpUtility.ParseQueryString(url.Query);
        return (email, new VerificationLink(Guid.Parse(query["userId"]!), query["token"]!));
    }

    private Task<HttpResponseMessage> Verify(VerificationLink link) =>
        factory.CreateClient().PostAsJsonAsync("/api/account/verify-email", new { link.UserId, link.Token });

    private static Task<HttpResponseMessage> Resend(HttpClient client, string email) =>
        client.PostAsJsonAsync("/api/account/resend-verification", new { email });

    private static async Task AssertTokenError(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal(["Token"], problem!.Errors.Keys);
    }

    private sealed record VerificationLink(Guid UserId, string Token);
}
