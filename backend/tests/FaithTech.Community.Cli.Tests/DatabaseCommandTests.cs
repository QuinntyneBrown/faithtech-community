using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Cli.Tests;

public class DatabaseCommandTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Migrate_applies_every_pending_migration()
    {
        var exitCode = await CliApp.RunAsync(["migrate"], postgres.ConnectionString);

        Assert.Equal(0, exitCode);
        await using var db = CreateContext();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }

    [Fact]
    public async Task Reset_drops_data_and_recreates_the_schema()
    {
        await CliApp.RunAsync(["migrate"], postgres.ConnectionString);
        await using (var db = CreateContext())
        {
            db.Profiles.Add(new Profile("Ada"));
            await db.SaveChangesAsync();
        }

        var exitCode = await CliApp.RunAsync(["reset"], postgres.ConnectionString);

        Assert.Equal(0, exitCode);
        await using var after = CreateContext();
        Assert.Empty(await after.Database.GetPendingMigrationsAsync());
        Assert.Empty(await after.Profiles.ToListAsync());
    }

    [Fact]
    public async Task Unknown_command_returns_a_usage_error()
    {
        Assert.Equal(1, await CliApp.RunAsync(["bogus"], postgres.ConnectionString));
    }

    private CommunityDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseNpgsql(postgres.ConnectionString).UseOpenIddict().Options);
}
