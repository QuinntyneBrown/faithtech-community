// Traces to: L2-150 AC1, AC3, AC5
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

// org suspend and org lift change an organisation's status from the command line, as the operator API does.
public class OrgSuspendCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private const string Operator = "ops@platform.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    private async Task ProvisionAsync()
    {
        Assert.Equal(0, await Run(new StringWriter(), "seed"));
        Assert.Equal(0, await Run(new StringWriter(),
            "org", "create", "--slug", "northside", "--host", "app.northside.org", "--name", "Northside Church",
            "--short-name", "Northside", "--admin-email", "joel@northside.org", "--operator", Operator));
    }

    [Fact]
    public async Task Suspends_with_a_reason_and_lifts_again_with_both_on_the_platform_audit()
    {
        await ProvisionAsync();
        var output = new StringWriter();

        Assert.Equal(0, await Run(output, "org", "suspend", "northside", "--reason", "Unpaid since March", "--operator", Operator));

        Assert.Contains("Organisation northside suspended", output.ToString());
        await using (var db = Db())
        {
            var organisation = await db.Organisations.SingleAsync(o => o.Slug == "northside");
            Assert.Equal((OrganisationStatus.Suspended, "Unpaid since March"), (organisation.Status, organisation.SuspendedReason));
        }

        Assert.Equal(0, await Run(output, "org", "lift", "northside", "--operator", Operator));

        Assert.Contains("Organisation northside lifted", output.ToString());
        await using (var db = Db())
        {
            Assert.Equal(OrganisationStatus.Active, (await db.Organisations.SingleAsync(o => o.Slug == "northside")).Status);
            var entries = await db.PlatformAuditEntries.OrderBy(e => e.OccurredAtUtc).Select(e => new { e.Action, Source = e.Source.ToString() }).ToListAsync();
            Assert.Equal(["organisation.provisioned", "organisation.suspended", "organisation.lifted"], entries.Select(e => e.Action));
            Assert.All(entries, e => Assert.Equal("Cli", e.Source));
        }
    }

    [Fact]
    public async Task Refuses_without_a_reason_an_unknown_slug_a_wrong_status_or_an_unlisted_operator()
    {
        await ProvisionAsync();

        Assert.Equal(1, await Run(new StringWriter(), "org", "suspend", "northside", "--operator", Operator));
        Assert.Equal(1, await Run(new StringWriter(), "org", "suspend", "nowhere", "--reason", "x", "--operator", Operator));
        Assert.Equal(1, await Run(new StringWriter(), "org", "lift", "northside", "--operator", Operator));
        Assert.Equal(1, await Run(new StringWriter(), "org", "suspend", "northside", "--reason", "x", "--operator", "priya@example.org"));
        Assert.Equal(1, await Run(new StringWriter(), "org", "suspend", "--reason", "x", "--operator", Operator));
        await using var db = Db();
        Assert.Equal(OrganisationStatus.Active, (await db.Organisations.SingleAsync(o => o.Slug == "northside")).Status);
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(TextWriter output, params string[] args) =>
        CliApp.RunAsync(args, options => options.UseInMemoryDatabase(_name, _root), Origin, output: output, operators: [Operator]);
}
