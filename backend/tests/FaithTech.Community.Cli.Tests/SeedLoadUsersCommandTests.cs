// Traces to: L2-046 AC1
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

/// <summary>The isolated performance environment's distinct, verified load-test members (eng/load-test.js).</summary>
public class SeedLoadUsersCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private const string Password = "a-load-test-passphrase";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Creates_the_requested_number_of_verified_members_who_can_sign_in_and_is_safe_to_rerun()
    {
        Assert.Equal(0, await Run(Password, "seed-load-users", "3"));
        Assert.Equal(0, await Run(Password, "seed-load-users", "3"));

        await using var db = Db();
        var users = await db.Users.OrderBy(u => u.Email).ToListAsync();
        Assert.Equal(["load-001@loadtest.invalid", "load-002@loadtest.invalid", "load-003@loadtest.invalid"], users.Select(u => u.Email));
        Assert.All(users, u => Assert.True(u.EmailConfirmed));
        var hasher = new PasswordHasher<CommunityUser>();
        Assert.All(users, u => Assert.NotEqual(PasswordVerificationResult.Failed, hasher.VerifyHashedPassword(u, u.PasswordHash!, Password)));
        // Plain members: no role, so the run exercises the member permissions and changes nothing else.
        Assert.All(await db.Profiles.ToListAsync(), p => Assert.Empty(p.Roles));
        Assert.Equal(3, await db.Profiles.CountAsync());
    }

    [Theory]
    [InlineData(null, "3")]
    [InlineData("short", "3")]
    [InlineData(Password, "0")]
    [InlineData(Password, "1001")]
    [InlineData(Password, "many")]
    public async Task Refuses_without_a_strong_password_in_the_environment_or_a_bounded_count(string? password, string count)
    {
        Assert.Equal(1, await Run(password, "seed-load-users", count));

        await using var db = Db();
        Assert.Empty(await db.Users.ToListAsync());
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(string? password, params string[] args) =>
        CliApp.RunAsync(
            args,
            options => options.UseInMemoryDatabase(_name, _root),
            Origin,
            name => name == CliApp.LoadTestPasswordVariable ? password : null);
}
