using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using OpenIddict.EntityFrameworkCore.Models;

namespace FaithTech.Community.Cli.Tests;

public class SeedCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Seed_registers_the_web_app_as_a_public_pkce_client_once()
    {
        Assert.Equal(0, await Run("seed"));
        Assert.Equal(0, await Run("seed"));

        await using var db = new CommunityDbContext(
            new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);
        var client = await db.Set<OpenIddictEntityFrameworkCoreApplication>().SingleAsync(a => a.ClientId == "web");
        Assert.Equal("public", client.ClientType);
        Assert.Null(client.ClientSecret);
        Assert.Contains($"{Origin}/auth/callback", client.RedirectUris);
        Assert.Contains("ft:pkce", client.Requirements);
    }

    // Traces to: L2-055
    [Fact]
    public async Task Seed_adds_the_starter_resources_once_owned_by_the_first_system_admin()
    {
        var admin = new FaithTech.Community.Domain.Profiles.Profile("Priya Shah");
        admin.AddRole(FaithTech.Community.Domain.Profiles.Role.SystemAdmin, Guid.Empty, DateTime.UtcNow);
        await using (var setup = Db())
        {
            setup.Profiles.Add(admin);
            await setup.SaveChangesAsync();
        }

        Assert.Equal(0, await Run("seed"));
        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        var resources = await db.Resources.ToListAsync();
        Assert.Equal(CommunitySeeder.StarterResources.Count, resources.Count);
        Assert.All(resources, r => Assert.Equal((admin.Id, FaithTech.Community.Domain.Resources.ResourceVisibility.Global), (r.OwnerId, r.Visibility)));
        Assert.All(resources, r => Assert.StartsWith("https://", r.LinkUrl));
    }

    [Fact]
    public async Task Seed_adds_no_resources_while_there_is_no_system_admin_to_own_them()
    {
        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        Assert.Empty(await db.Resources.ToListAsync());
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(string command) =>
        CliApp.RunAsync([command], options => options.UseInMemoryDatabase(_name, _root), Origin);
}
