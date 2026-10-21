using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using OpenIddict.EntityFrameworkCore.Models;

namespace FaithTech.Community.Cli.Tests;

public class SeedCommandTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    private const string Origin = "https://app.faithtech.test";

    [Fact]
    public async Task Seed_registers_the_web_app_as_a_public_pkce_client_once()
    {
        await CliApp.RunAsync(["migrate"], postgres.ConnectionString);

        Assert.Equal(0, await CliApp.RunAsync(["seed"], postgres.ConnectionString, Origin));
        Assert.Equal(0, await CliApp.RunAsync(["seed"], postgres.ConnectionString, Origin));

        await using var db = new CommunityDbContext(
            new DbContextOptionsBuilder<CommunityDbContext>().UseNpgsql(postgres.ConnectionString).UseOpenIddict().Options);
        var client = await db.Set<OpenIddictEntityFrameworkCoreApplication>().SingleAsync(a => a.ClientId == "web");
        Assert.Equal("public", client.ClientType);
        Assert.Null(client.ClientSecret);
        Assert.Contains($"{Origin}/auth/callback", client.RedirectUris);
        Assert.Contains("ft:pkce", client.Requirements);
    }
}
