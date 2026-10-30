using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Api.Tests.Profiles;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Identity;

public class SignUpTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string ValidPassword = "a-long-enough-passphrase";

    [Fact]
    public async Task Valid_sign_up_creates_an_account_with_no_role_and_sends_a_verification_email()
    {
        var email = UniqueEmail();

        var response = await SignUp("Grace Hopper", email, ValidPassword);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var (user, profile) = await factory.WithDbAsync(async db =>
        {
            var u = await db.Users.SingleAsync(x => x.Email == email);
            return (u, await db.Profiles.SingleAsync(p => p.Id == u.ProfileId));
        });
        Assert.False(user.EmailConfirmed);
        Assert.Equal("Grace Hopper", profile.Name);
        Assert.Empty(profile.Roles);
        var message = Assert.Single(factory.Emails.SentTo(email));
        Assert.Contains($"{CommunityApiFactory.WebAppOrigin}/verify-email?", message.Body);
    }

    [Fact]
    public async Task Existing_email_gets_the_same_outcome_and_creates_nothing()
    {
        var email = UniqueEmail();
        await SignUp("First", email, ValidPassword);

        var response = await SignUp("Second", email.ToUpperInvariant(), ValidPassword);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync());
        Assert.Equal(1, await factory.WithDbAsync(db => db.Users.CountAsync(u => u.NormalizedEmail == email.ToUpperInvariant())));
        Assert.False(await factory.WithDbAsync(db => db.Profiles.AnyAsync(p => p.Name == "Second")));
    }

    [Theory]
    [InlineData("short-pass1")]
    [InlineData(FakeBreachedPasswordChecker.BreachedPassword)]
    public async Task Weak_password_is_rejected_on_the_password_field(string password)
    {
        var email = UniqueEmail();

        var response = await SignUp("Weak", email, password);

        var problem = await AssertValidationProblem(response);
        Assert.Equal(["Password"], problem.Errors.Keys);
        Assert.False(await factory.WithDbAsync(db => db.Users.AnyAsync(u => u.Email == email)));
    }

    [Fact]
    public async Task Empty_and_malformed_fields_each_get_an_error()
    {
        var response = await SignUp("", "not-an-email", "");

        var problem = await AssertValidationProblem(response);
        Assert.Equal(["Email", "Name", "Password"], problem.Errors.Keys.Order());
    }

    [Fact]
    public async Task Name_longer_than_the_profile_limit_is_rejected_and_no_account_is_created()
    {
        var email = UniqueEmail();

        var response = await SignUp(new string('a', 101), email, OidcFlow.Password);

        var problem = await AssertValidationProblem(response);
        Assert.Equal(["Use 100 characters or fewer for your name."], problem.Errors["Name"]);
        Assert.False(await factory.WithDbAsync(db => db.Users.AnyAsync(u => u.Email == email)));
    }

    [Fact]
    public async Task Name_at_the_profile_limit_can_be_saved_unchanged_in_the_profile_editor()
    {
        var email = UniqueEmail();
        var name = new string('a', 100);
        (await SignUp(name, email, OidcFlow.Password)).EnsureSuccessStatusCode();
        var member = await factory.WithDbAsync(db => db.Users.Where(u => u.Email == email)
            .Select(u => new ProfileClients.Member(u.Id, u.ProfileId)).SingleAsync());

        var response = await factory.ClientFor(member).PutAsJsonAsync($"/api/profiles/{member.ProfileId}",
            new { Name = name, HomeCity = "Toronto", Bio = "" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task The_21st_auth_request_in_a_minute_from_one_address_returns_429()
    {
        var client = factory.WithWebHostBuilder(b => b.UseSetting("RateLimits:AuthPerMinute", "20")).CreateClient();

        for (var i = 0; i < 20; i++)
        {
            await client.PostAsJsonAsync("/api/account/sign-up", new { Name = "", Email = "", Password = "" });
        }

        var response = await client.PostAsJsonAsync("/api/account/sign-up", new { Name = "", Email = "", Password = "" });
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    // Traces to: L2-125 AC1 (docs/detailed-designs/reports/reports-dashboard): the account's creation time is the
    // member's join time, which Reports counts as new members.
    [Fact]
    public async Task Sign_up_records_the_join_time()
    {
        var email = UniqueEmail();

        await SignUp("Grace Hopper", email, ValidPassword);

        Assert.Equal(factory.Time.GetUtcNow().UtcDateTime, await JoinedAtOfAsync(email));
    }

    private Task<DateTime?> JoinedAtOfAsync(string email) =>
        factory.WithDbAsync(async db =>
        {
            var user = await db.Users.AsNoTracking().SingleAsync(u => u.Email == email);
            return (await db.Profiles.AsNoTracking().SingleAsync(p => p.Id == user.ProfileId)).JoinedAtUtc;
        });

    private Task<HttpResponseMessage> SignUp(string name, string email, string password) =>
        factory.CreateClient().PostAsJsonAsync("/api/account/sign-up", new { name, email, password });

    private static async Task<ValidationProblemDetails> AssertValidationProblem(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
    }

    private static string UniqueEmail() => $"{Guid.NewGuid():N}@example.com";
}
