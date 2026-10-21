using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

public class DatabaseCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Migrate_creates_a_usable_schema()
    {
        Assert.Equal(0, await Run("migrate"));

        await using var db = CreateContext();
        db.Profiles.Add(new Profile("Ada"));
        Assert.Equal(1, await db.SaveChangesAsync());
    }

    [Fact]
    public async Task Reset_drops_existing_data()
    {
        await Run("migrate");
        await using (var db = CreateContext())
        {
            db.Profiles.Add(new Profile("Ada"));
            await db.SaveChangesAsync();
        }

        Assert.Equal(0, await Run("reset"));

        await using var after = CreateContext();
        Assert.Empty(await after.Profiles.ToListAsync());
    }

    [Fact]
    public async Task Unknown_command_returns_a_usage_error()
    {
        Assert.Equal(1, await Run("bogus"));
    }

    private Task<int> Run(string command) =>
        CliApp.RunAsync([command], options => options.UseInMemoryDatabase(_name, _root), Origin);

    private CommunityDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);
}
