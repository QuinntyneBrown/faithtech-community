// Traces to: L2-148 AC2, AC4
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

// org audit prints the platform audit log, newest first, for an operator named in Platform:Operators.
public class OrgAuditCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private const string Operator = "ops@platform.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Prints_the_newest_entries_first()
    {
        await AddEntriesAsync();
        var output = new StringWriter();

        var exit = await Run(output, "org", "audit", "--operator", "OPS@platform.test");

        Assert.Equal(0, exit);
        var lines = output.ToString().TrimEnd().Split(Environment.NewLine);
        Assert.Equal(3, lines.Length);
        Assert.Contains("account.unlocked", lines[0]);
        Assert.Contains("account.locked", lines[1]);
        Assert.Contains("organisation.provisioned", lines[2]);
        Assert.Contains("northside", lines[2]);
        Assert.Contains(Operator, lines[0]);
        Assert.Contains("Cli", lines[2]);
    }

    [Fact]
    public async Task Take_limits_how_many_are_printed()
    {
        await AddEntriesAsync();
        var output = new StringWriter();

        Assert.Equal(0, await Run(output, "org", "audit", "--take", "1", "--operator", Operator));

        Assert.Single(output.ToString().TrimEnd().Split(Environment.NewLine));
        Assert.Contains("account.unlocked", output.ToString());
    }

    [Theory]
    [InlineData]
    [InlineData("--operator", "priya@example.org")]
    [InlineData("--operator")]
    public async Task Refuses_anyone_not_listed_as_an_operator(params string[] operatorOption)
    {
        await AddEntriesAsync();
        var output = new StringWriter();

        Assert.Equal(1, await Run(output, ["org", "audit", .. operatorOption]));

        Assert.Empty(output.ToString());
    }

    [Fact]
    public async Task Rejects_a_take_that_is_not_a_positive_number()
    {
        Assert.Equal(1, await Run(new StringWriter(), "org", "audit", "--take", "none", "--operator", Operator));
        Assert.Equal(1, await Run(new StringWriter(), "org", "audit", "--take", "0", "--operator", Operator));
    }

    private async Task AddEntriesAsync()
    {
        await using var db = Db();
        var now = DateTime.UtcNow;
        db.PlatformAuditEntries.AddRange(
            new PlatformAuditEntry(Operator, PlatformAuditSource.Cli, "organisation.provisioned", "northside", "northside", null, now.AddHours(-2)),
            new PlatformAuditEntry(Operator, PlatformAuditSource.Api, "account.locked", null, "victor@example.org", "{\"Reason\":\"Spam\"}", now.AddHours(-1)),
            new PlatformAuditEntry(Operator, PlatformAuditSource.Api, "account.unlocked", null, "victor@example.org", null, now));
        await db.SaveChangesAsync();
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(TextWriter output, params string[] args) =>
        CliApp.RunAsync(args, options => options.UseInMemoryDatabase(_name, _root), Origin, output: output, operators: [Operator]);
}
