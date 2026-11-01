// Traces to: L2-149 AC1, AC2, AC3, AC4; L2-148 AC2, AC4
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

// org create provisions an organisation from the command line, as the operator API does.
public class OrgCreateCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private const string Operator = "ops@platform.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    private static readonly string[] Create =
    [
        "org", "create", "--slug", "northside", "--host", "app.northside.org", "--name", "Northside Church",
        "--short-name", "Northside", "--chapter-label", "Campus/Campuses", "--admin-email", "joel@northside.org", "--operator", Operator,
    ];

    [Fact]
    public async Task Creates_the_organisation_with_its_defaults_and_invites_the_first_administrator()
    {
        Assert.Equal(0, await Run(new StringWriter(), "seed"));
        var output = new StringWriter();

        Assert.Equal(0, await Run(output, Create));

        Assert.Contains("Organisation northside created", output.ToString());
        await using var db = Db();
        var organisation = await db.Organisations.SingleAsync(o => o.Slug == "northside");
        Assert.Equal(("app.northside.org", "Active", "Campus", "Campuses"),
            (organisation.Host, organisation.Status.ToString(), organisation.ChapterLabelSingular, organisation.ChapterLabelPlural));
        Assert.Equal(["Administrator", "Member"],
            await db.RoleDefinitions.IgnoreQueryFilters().Where(d => d.OrganisationId == organisation.Id).OrderBy(d => d.SortOrder).Select(d => d.Name).ToListAsync());
        var invite = await db.Invites.IgnoreQueryFilters().SingleAsync(i => i.OrganisationId == organisation.Id);
        Assert.Equal(("joel@northside.org", "administrator"), (invite.Email, invite.PreassignedRole));
        var entry = await db.PlatformAuditEntries.SingleAsync();
        Assert.Equal(("organisation.provisioned", Operator, "Cli"), (entry.Action, entry.OperatorEmail, entry.Source.ToString()));
    }

    [Fact]
    public async Task Running_it_again_reports_the_organisation_exists()
    {
        Assert.Equal(0, await Run(new StringWriter(), "seed"));
        Assert.Equal(0, await Run(new StringWriter(), Create));
        var output = new StringWriter();

        Assert.Equal(0, await Run(output, Create));

        Assert.Contains("Organisation northside exists", output.ToString());
        await using var db = Db();
        Assert.Equal(1, await db.PlatformAuditEntries.CountAsync());
    }

    [Fact]
    public async Task Refuses_a_conflict_an_invalid_field_or_an_unlisted_operator()
    {
        Assert.Equal(0, await Run(new StringWriter(), "seed"));
        Assert.Equal(0, await Run(new StringWriter(), Create));
        string[] renamed = [.. Create.Select(a => a == "Northside Church" ? "Northside Fellowship" : a)];
        string[] badSlug = [.. Create.Select(a => a == "northside" ? "North_Side" : a)];
        string[] stranger = [.. Create.Select(a => a == Operator ? "priya@example.org" : a)];
        string[] oneLabel = [.. Create.Select(a => a == "Campus/Campuses" ? "Campus" : a)];

        Assert.Equal(1, await Run(new StringWriter(), renamed));
        Assert.Equal(1, await Run(new StringWriter(), badSlug));
        Assert.Equal(1, await Run(new StringWriter(), stranger));
        Assert.Equal(1, await Run(new StringWriter(), [.. oneLabel.Select(a => a switch { "northside" => "southside", "app.northside.org" => "app.southside.org", _ => a })]));
        await using var db = Db();
        Assert.Equal("Northside Church", (await db.Organisations.SingleAsync(o => o.Slug == "northside")).Name);
        Assert.False(await db.Organisations.AnyAsync(o => o.Slug == "southside"));
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(TextWriter output, params string[] args) =>
        CliApp.RunAsync(args, options => options.UseInMemoryDatabase(_name, _root), Origin, output: output, operators: [Operator]);
}
