// Traces to: L2-104 AC1 (docs/detailed-designs/reports/reports-dashboard)
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

/// <summary>
/// The reports volume an isolated performance environment needs for the Reports load test: members across six cities
/// with join times, one event for every ten members, and 50 RSVPs on each event with check-ins on past ones.
/// </summary>
public class SeedReportRecordsCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Seeds_members_events_and_rsvps_for_the_reports_load_test_once()
    {
        Assert.Equal(0, await Run("seed-report-records", "60"));
        Assert.Equal(0, await Run("seed-report-records", "60"));

        await using var db = Db();
        var members = await db.Users.Where(u => u.Email!.EndsWith("@" + CommunitySeeder.LoadTestDomain)).ToListAsync();
        Assert.Equal(60, members.Count);
        Assert.All(members, m => Assert.True(m.EmailConfirmed));
        var profiles = await db.Profiles.Where(p => p.Name.StartsWith(CommunitySeeder.ReportRecordPrefix)).ToListAsync();
        Assert.Equal(60, profiles.Count);
        Assert.Equal(6, profiles.Select(p => p.HomeCity).Distinct().Count());
        Assert.All(profiles, p => Assert.NotNull(p.JoinedAtUtc));
        var events = await db.Events.Include(e => e.Rsvps).Where(e => e.Title.StartsWith(CommunitySeeder.ReportRecordPrefix)).ToListAsync();
        Assert.Equal(6, events.Count);
        Assert.All(events, e => Assert.Equal(50, e.Rsvps.Count));
        Assert.Contains(events, e => e.Rsvps.Any(r => r.CheckedInAt != null));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("lots")]
    [InlineData("100001")]
    public async Task Refuses_a_count_out_of_range(string count)
    {
        Assert.Equal(1, await Run("seed-report-records", count));
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(params string[] args) =>
        CliApp.RunAsync(args, options => options.UseInMemoryDatabase(_name, _root), Origin);
}
