// Traces to: L2-026 AC5
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

/// <summary>The searchable records an isolated performance environment needs for the search load test.</summary>
public class SeedSearchRecordsCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Seeds_the_requested_number_of_searchable_events_once()
    {
        Assert.Equal(0, await Run("seed-search-records", "25"));
        Assert.Equal(0, await Run("seed-search-records", "30"));

        await using var db = Db();
        var titles = await db.Events.Select(e => e.Title).ToListAsync();
        Assert.Equal(30, titles.Count);
        Assert.Equal(30, titles.Distinct().Count());
        Assert.All(titles, t => Assert.StartsWith(CommunitySeeder.SearchRecordPrefix, t));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("lots")]
    [InlineData("1000001")]
    public async Task Refuses_a_count_out_of_range(string count)
    {
        Assert.Equal(1, await Run("seed-search-records", count));
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(params string[] args) =>
        CliApp.RunAsync(args, options => options.UseInMemoryDatabase(_name, _root), Origin);
}
