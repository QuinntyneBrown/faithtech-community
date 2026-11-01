// Traces to: L2-151 AC6; L2-109 AC4; L2-151 AC4
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using OpenIddict.EntityFrameworkCore.Models;

namespace FaithTech.Community.Cli.Tests;

// seed is the production seed: the web client, the FaithTech organisation and its lists, its administrator roster and
// the starter resources, and nothing else; demo and load-test data come only from their own commands.
public class ProductionSeedTests
{
    private const string Origin = "https://app.faithtech.community";
    private const string Operator = "ops@platform.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Seeding_an_empty_database_inserts_only_the_production_seed()
    {
        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        Assert.Equal(["web"], await db.Set<OpenIddictEntityFrameworkCoreApplication>().Select(a => a.ClientId).ToListAsync());
        Assert.Equal(["faithtech"], await db.Organisations.Select(o => o.Slug).ToListAsync());
        Assert.Equal(9, await db.RoleDefinitions.CountAsync());
        Assert.Equal(3, await db.PartnerStages.CountAsync());
        Assert.Equal(5, await db.EventTypes.CountAsync());
        Assert.Equal(7, await db.ResourceTypes.CountAsync());
        Assert.Equal(1, await db.OrganisationAdminRosters.CountAsync());
        // The starter resources wait for a System Admin to own them, and there is none on a fresh database.
        Assert.Empty(await db.Resources.ToListAsync());
        Assert.Empty(await db.Users.ToListAsync());
        Assert.Empty(await db.Profiles.ToListAsync());
        Assert.Empty(await db.Chapters.ToListAsync());
        Assert.Empty(await db.Events.ToListAsync());
        Assert.Empty(await db.Partners.ToListAsync());
        Assert.Empty(await db.Contacts.ToListAsync());
        Assert.Empty(await db.Invites.ToListAsync());
        Assert.Empty(await db.OutboxMessages.ToListAsync());
        Assert.Empty(await db.AuditEntries.ToListAsync());
        Assert.Empty(await db.PlatformAuditEntries.ToListAsync());
    }

    [Fact]
    public async Task Seeding_again_keeps_every_provisioned_host_as_a_redirect_uri()
    {
        Assert.Equal(0, await Run("seed"));
        Assert.Equal(0, await Run(
            "org", "create", "--slug", "northside", "--host", "app.northside.org", "--name", "Northside Church",
            "--short-name", "Northside", "--admin-email", "joel@northside.org", "--operator", Operator));

        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        var client = await db.Set<OpenIddictEntityFrameworkCoreApplication>().SingleAsync(a => a.ClientId == "web");
        Assert.Contains($"{Origin}/auth/callback", client.RedirectUris);
        Assert.Contains("https://app.northside.org/auth/callback", client.RedirectUris);
        Assert.Equal(["faithtech", "northside"], await db.Organisations.OrderBy(o => o.CreatedAtUtc).Select(o => o.Slug).ToListAsync());
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(params string[] args) =>
        CliApp.RunAsync(args, options => options.UseInMemoryDatabase(_name, _root), Origin, operators: [Operator]);
}
