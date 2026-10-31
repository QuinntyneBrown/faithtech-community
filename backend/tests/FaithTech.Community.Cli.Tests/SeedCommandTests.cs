using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using OpenIddict.EntityFrameworkCore.Models;

namespace FaithTech.Community.Cli.Tests;

public class SeedCommandTests
{
    private const string Origin = "https://app.faithtech.test";
    private readonly InMemoryDatabaseRoot _root = new();
    private readonly string _name = Guid.NewGuid().ToString();

    [Fact]
    public async Task Seed_registers_the_web_app_as_a_public_pkce_client_once()
    {
        Assert.Equal(0, await Run("seed"));
        Assert.Equal(0, await Run("seed"));

        await using var db = new CommunityDbContext(
            new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);
        var client = await db.Set<OpenIddictEntityFrameworkCoreApplication>().SingleAsync(a => a.ClientId == "web");
        Assert.Equal("public", client.ClientType);
        Assert.Null(client.ClientSecret);
        Assert.Contains($"{Origin}/auth/callback", client.RedirectUris);
        Assert.Contains("ft:pkce", client.Requirements);
    }

    // Traces to: L2-151 AC1
    [Fact]
    public async Task Seed_creates_the_FaithTech_organisation_once_and_keeps_its_later_edits()
    {
        Assert.Equal(0, await Run("seed"));
        await using (var edit = Db())
        {
            (await edit.Organisations.SingleAsync()).Rename("FaithTech Global", "FT");
            await edit.SaveChangesAsync();
        }

        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        var organisation = await db.Organisations.SingleAsync();
        Assert.Equal(
            ("faithtech", "app.faithtech.community", "City", "Cities", FaithTech.Community.Domain.Organisations.OrganisationStatus.Active),
            (organisation.Slug, organisation.Host, organisation.ChapterLabelSingular, organisation.ChapterLabelPlural, organisation.Status));
        Assert.Equal(("FaithTech Global", "FT"), (organisation.Name, organisation.ShortName));
    }

    [Fact]
    public async Task Seed_names_the_FaithTech_organisation()
    {
        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        var organisation = await db.Organisations.SingleAsync();
        Assert.Equal(("FaithTech Community", "FaithTech"), (organisation.Name, organisation.ShortName));
    }

    // Traces to: L2-151 AC2
    [Fact]
    public async Task Seed_defines_FaithTechs_nine_roles_and_the_City_Lead_grant_rules_once()
    {
        Assert.Equal(0, await Run("seed"));
        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        var definitions = await db.RoleDefinitions.OrderBy(d => d.SortOrder).ToListAsync();
        Assert.Equal(
            [
                ("City Lead", "AddResources AssignRoles ConnectLink InviteMembers JoinWorkspaces KeepContacts ManageAttendance ManageEvents ManagePartners OwnWorkspaces ViewAttendees ViewPartners ViewPeopleDirectory", true, true, false),
                ("Event Lead", "AddResources InviteMembers JoinWorkspaces KeepContacts ManageAttendance ManageEvents ManagePartners ViewAttendees ViewPartners", true, true, false),
                ("Create Lead", "AddResources InviteMembers JoinWorkspaces KeepContacts ManageAttendance ManagePartners ViewAttendees ViewPartners", true, true, false),
                ("Communications Lead", "AddResources InviteMembers JoinWorkspaces KeepContacts ManageAttendance ManagePartners SendAnnouncements ViewAttendees ViewPartners", true, true, false),
                ("Staff", "AddResources ReadAllWorkspaces ViewAttendees ViewPartners ViewPeopleDirectory ViewReports", false, false, true),
                ("Volunteer", "JoinWorkspaces", true, true, false),
                ("Product Engineer", "", false, false, false),
                ("Attendee", "", false, false, false),
                ("System Admin", "AdministerOrganisation", false, false, false),
            ],
            definitions.Select(d => (d.Name, string.Join(' ', d.Capabilities.Order(StringComparer.Ordinal)), d.ShowOnTeam, d.ChapterScopable, d.IsOversight)));

        var names = definitions.ToDictionary(d => d.Id, d => d.Name);
        Assert.Equal(
            ["Attendee", "Communications Lead", "Create Lead", "Event Lead", "Product Engineer", "Volunteer"],
            definitions.Single(d => d.Name == "City Lead").Grants.Select(g => names[g.GrantableRoleId]).Order());
        Assert.All(definitions.Where(d => d.Name != "City Lead"), d => Assert.Empty(d.Grants));
    }

    // Traces to: L2-151 AC3
    [Fact]
    public async Task Seed_defines_FaithTechs_partner_stages_once_and_keeps_their_later_edits()
    {
        Assert.Equal(0, await Run("seed"));
        await using (var db = Db())
        {
            (await db.PartnerStages.SingleAsync(s => s.Key == "in-funnel")).Rename("Proposal sent");
            await db.SaveChangesAsync();
        }

        Assert.Equal(0, await Run("seed"));

        await using var check = Db();
        Assert.Equal(
            [("lead", "Lead", true, "Open"), ("in-funnel", "Proposal sent", false, "Open"), ("confirmed", "Confirmed", false, "Confirmed")],
            (await check.PartnerStages.OrderBy(s => s.SortOrder).ToListAsync()).Select(s => (s.Key, s.Name, s.IsInitial, s.Kind.ToString())));
    }

    // Traces to: L2-055
    [Fact]
    public async Task Seed_adds_the_starter_resources_once_owned_by_the_first_system_admin()
    {
        var admin = new FaithTech.Community.Domain.Profiles.Profile("Priya Shah");
        admin.AddRole(FaithTech.Community.Infrastructure.Persistence.Seed.FaithTechSeed.Roles.Single(r => r.Key == "SystemAdmin").Id, Guid.Empty, DateTime.UtcNow);
        await using (var setup = Db())
        {
            setup.Profiles.Add(admin);
            await setup.SaveChangesAsync();
        }

        Assert.Equal(0, await Run("seed"));
        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        var resources = await db.Resources.ToListAsync();
        Assert.Equal(CommunitySeeder.StarterResources.Count, resources.Count);
        Assert.All(resources, r => Assert.Equal((admin.Id, FaithTech.Community.Domain.Resources.ResourceVisibility.Global), (r.OwnerId, r.Visibility)));
        Assert.All(resources, r => Assert.StartsWith("https://", r.LinkUrl));
    }

    [Fact]
    public async Task Seed_adds_no_resources_while_there_is_no_system_admin_to_own_them()
    {
        Assert.Equal(0, await Run("seed"));

        await using var db = Db();
        Assert.Empty(await db.Resources.ToListAsync());
    }

    private CommunityDbContext Db() =>
        new(new DbContextOptionsBuilder<CommunityDbContext>().UseInMemoryDatabase(_name, _root).UseOpenIddict().Options);

    private Task<int> Run(string command) =>
        CliApp.RunAsync([command], options => options.UseInMemoryDatabase(_name, _root), Origin);
}
