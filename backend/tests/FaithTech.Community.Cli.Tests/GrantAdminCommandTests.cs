// Traces to: L2-009 AC6, L2-041 AC1
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace FaithTech.Community.Cli.Tests;

public class GrantAdminCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Grants_system_admin_to_an_existing_account_once_and_audits_it()
    {
        var profileId = await AddAccountAsync("priya@example.org");

        Assert.Equal(0, await Run("grant-admin", "Priya@Example.org"));
        Assert.Equal(0, await Run("grant-admin", "priya@example.org"));

        await using var db = Db();
        var profile = await db.Profiles.SingleAsync(p => p.Id == profileId);
        Assert.Equal([Role.SystemAdmin], profile.Roles.Select(r => r.Role));
        var entry = await db.AuditEntries.SingleAsync();
        Assert.Equal(("role.granted", profileId.ToString(), "cli"), (entry.Action, entry.TargetId, entry.IpAddress));
    }

    [Fact]
    public async Task Fails_for_an_unknown_email_or_a_missing_argument()
    {
        Assert.Equal(1, await Run("grant-admin", "nobody@example.org"));
        Assert.Equal(1, await Run("grant-admin"));
    }

    private async Task<Guid> AddAccountAsync(string email)
    {
        await using var db = Db();
        var profile = new Profile("Priya Shah");
        var user = new CommunityUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
        };
        profile.LinkAccount(user.Id);
        db.Profiles.Add(profile);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return profile.Id;
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(params string[] args) =>
        CliApp.RunAsync(args, options => options.UseInMemoryDatabase(_name, _root), Origin);
}
