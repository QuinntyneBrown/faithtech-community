// Traces to: L2-151 AC5; L2-009 AC6; L2-130 AC1 (docs/detailed-designs/organisations/seed-faithtech, Cli)
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

// grant-admin <email> [organisation-slug] grants the organisation's administrator role; the slug defaults to
// Platform:DefaultOrganisationSlug.
public class GrantAdminInOrganisationTests
{
    private const string Origin = "https://app.faithtech.test";
    private const string Operator = "ops@platform.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    private async Task<Organisation> ProvisionNorthsideAsync()
    {
        Assert.Equal(0, await Run(defaultSlug: null, "seed"));
        Assert.Equal(0, await Run(defaultSlug: null,
            "org", "create", "--slug", "northside", "--host", "app.northside.org", "--name", "Northside Church",
            "--short-name", "Northside", "--admin-email", "joel@northside.org", "--operator", Operator));
        await using var db = Db();
        return await db.Organisations.AsNoTracking().SingleAsync(o => o.Slug == "northside");
    }

    [Fact]
    public async Task Grants_the_named_organisations_administrator_role_and_audits_it_there_only()
    {
        var northside = await ProvisionNorthsideAsync();
        var (userId, faithTechProfile) = await AddAccountAsync("priya@example.org", null);
        var (_, northsideProfile) = await AddAccountAsync("priya@example.org", northside, userId);

        Assert.Equal(0, await Run(defaultSlug: null, "grant-admin", "Priya@Example.org", "northside"));
        Assert.Equal(0, await Run(defaultSlug: null, "grant-admin", "priya@example.org", "northside"));

        await using (var db = Db(northside))
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == northsideProfile);
            Assert.Equal(["administrator"], profile.Roles.Select(r => r.Definition!.Key));
            var entry = await db.AuditEntries.SingleAsync();
            Assert.Equal(("role.granted", northsideProfile.ToString(), "cli"), (entry.Action, entry.TargetId, entry.IpAddress));
        }

        await using (var db = Db())
        {
            Assert.Empty((await db.Profiles.SingleAsync(p => p.Id == faithTechProfile)).Roles);
            Assert.Empty(await db.AuditEntries.ToListAsync());
        }
    }

    [Fact]
    public async Task Without_a_slug_it_grants_in_the_default_organisation()
    {
        var northside = await ProvisionNorthsideAsync();
        var (userId, _) = await AddAccountAsync("priya@example.org", null);
        var (_, northsideProfile) = await AddAccountAsync("priya@example.org", northside, userId);

        Assert.Equal(0, await Run(defaultSlug: "northside", "grant-admin", "priya@example.org"));

        await using var db = Db(northside);
        Assert.Equal(["administrator"], (await db.Profiles.SingleAsync(p => p.Id == northsideProfile)).Roles.Select(r => r.Definition!.Key));
    }

    [Fact]
    public async Task Fails_for_an_unknown_slug_or_an_account_with_no_profile_in_the_organisation()
    {
        await ProvisionNorthsideAsync();
        await AddAccountAsync("priya@example.org", null);

        Assert.Equal(1, await Run(defaultSlug: null, "grant-admin", "priya@example.org", "nowhere"));
        Assert.Equal(1, await Run(defaultSlug: null, "grant-admin", "priya@example.org", "northside"));
        Assert.Equal(1, await Run(defaultSlug: null, "grant-admin", "priya@example.org", "northside", "extra"));
    }

    // An account with a profile in the organisation (FaithTech when null); pass userId to reuse the account.
    private async Task<(Guid UserId, Guid ProfileId)> AddAccountAsync(string email, Organisation? organisation, Guid? userId = null)
    {
        await using var db = Db(organisation);
        var profile = new Profile("Priya Shah");
        if (userId is null)
        {
            var user = new CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                NormalizedUserName = email.ToUpperInvariant(),
            };
            db.Users.Add(user);
            userId = user.Id;
        }

        profile.LinkAccount(userId.Value);
        db.Profiles.Add(profile);
        await db.SaveChangesAsync();
        return (userId.Value, profile.Id);
    }

    private CommunityDbContext Db(Organisation? organisation = null)
    {
        var options = new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options;
        if (organisation is null)
        {
            return new(options);
        }

        var scope = new OrganisationScope();
        scope.Set(organisation);
        return new(options, scope);
    }

    private Task<int> Run(string? defaultSlug, params string[] args) =>
        CliApp.RunAsync(
            args, options => options.UseInMemoryDatabase(_name, _root), Origin, operators: [Operator], defaultOrganisationSlug: defaultSlug ?? "faithtech");
}
