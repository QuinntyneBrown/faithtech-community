// Traces to: L2-149 AC1, AC2, AC3, AC4, AC5; L2-134 AC5
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Api.Tests.Invites;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Tests.Organisations.Platform;

// An operator provisions an organisation with its host, defaults and an invite to its first administrator.
public class ProvisionOrganisationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Summary(string Slug, string Host, string Name, string ShortName, string Status, int AdministratorCount);

    public sealed record AuditItem(string OperatorEmail, string Source, string Action, string? OrganisationSlug, string Target, string? Details);

    public sealed record AuditPage(List<AuditItem> Items, int TotalCount);

    public sealed record Me(string[] Capabilities);

    private static object Command(string slug, string? adminEmail = null, object? chapterLabel = null, string? name = null) => new
    {
        Slug = slug,
        Host = $"app.{slug}.test",
        Name = name ?? "Riverside Church",
        ShortName = "Riverside",
        ChapterLabel = chapterLabel,
        AdminEmail = adminEmail ?? $"admin@{slug}.test",
    };

    private static string NewSlug() => $"rv-{Guid.NewGuid():N}"[..12];

    private Task<Organisation?> FindAsync(string slug) =>
        factory.WithDbAsync(db => db.Organisations.AsNoTracking().SingleOrDefaultAsync(o => o.Slug == slug));

    [Fact]
    public async Task Provisioning_creates_an_active_organisation_with_two_roles_and_default_lists()
    {
        var slug = NewSlug();
        var operatorClient = await factory.OperatorClientAsync();

        var response = await operatorClient.PostAsJsonAsync("/api/platform/organisations", Command(slug));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var summary = (await response.Content.ReadFromJsonAsync<Summary>())!;
        Assert.Equal((slug, $"app.{slug}.test", "Riverside Church", "Riverside", "Active", 0), (summary.Slug, summary.Host, summary.Name, summary.ShortName, summary.Status, summary.AdministratorCount));
        var organisation = (await FindAsync(slug))!;
        Assert.Null(organisation.ChapterLabelSingular);
        await factory.WithDbAsync(organisation.Id, async db =>
        {
            var roles = await db.RoleDefinitions.OrderBy(d => d.SortOrder).ToListAsync();
            Assert.Equal(["Administrator", "Member"], roles.Select(r => r.Name));
            Assert.Equal([Capability.AdministerOrganisation], roles[0].Capabilities);
            Assert.False(roles[0].ShowOnTeam);
            Assert.Empty(roles[1].Capabilities);
            Assert.Empty(await db.Chapters.IgnoreQueryFilters(FaithTech.Community.Application.Common.QueryFilters.ChaptersOnOnly).ToListAsync());
            var stages = await db.PartnerStages.OrderBy(s => s.SortOrder).ToListAsync();
            Assert.Equal([("New", true, PartnerStageKind.Open), ("Confirmed", false, PartnerStageKind.Confirmed)], stages.Select(s => (s.Name, s.IsInitial, s.Kind)));
            Assert.Equal(["Gathering"], await db.EventTypes.Select(t => t.Name).ToListAsync());
            Assert.Equal(["Deck", "Image", "Document", "Other"], await db.ResourceTypes.OrderBy(t => t.SortOrder).Select(t => t.Name).ToListAsync());
            Assert.Contains(await db.ResourceTypes.ToListAsync(), t => t.Key == ResourceType.OtherKey);
            Assert.Equal(1, await db.OrganisationAdminRosters.CountAsync());
            return 0;
        });
    }

    [Fact]
    public async Task A_chapter_label_turns_chapters_on_without_adding_any()
    {
        var slug = NewSlug();
        var operatorClient = await factory.OperatorClientAsync();

        (await operatorClient.PostAsJsonAsync("/api/platform/organisations", Command(slug, chapterLabel: new { Singular = "Campus", Plural = "Campuses" }))).EnsureSuccessStatusCode();

        var organisation = (await FindAsync(slug))!;
        Assert.Equal(("Campus", "Campuses"), (organisation.ChapterLabelSingular, organisation.ChapterLabelPlural));
        Assert.Equal(0, await factory.WithDbAsync(organisation.Id, db => db.Chapters.CountAsync()));
    }

    [Fact]
    public async Task The_first_administrator_is_invited_under_the_new_name_and_host_as_the_break_glass_grant()
    {
        var slug = NewSlug();
        var operatorClient = await factory.OperatorClientAsync();

        (await operatorClient.PostAsJsonAsync("/api/platform/organisations", Command(slug, adminEmail: $"Joel@{slug}.test"))).EnsureSuccessStatusCode();

        var organisation = (await FindAsync(slug))!;
        var invite = await factory.WithDbAsync(organisation.Id, db => db.Invites.AsNoTracking().SingleAsync());
        Assert.Equal(($"Joel@{slug}.test", "administrator"), (invite.Email, invite.PreassignedRole));
        var message = Assert.Single(await factory.QueuedEmailsToAsync(organisation.Id, $"Joel@{slug}.test"));
        Assert.Contains("Riverside Church", message.Subject);
        Assert.Contains($"https://app.{slug}.test/accept-invite/", message.Body);
        var audit = await operatorClient.GetFromJsonAsync<AuditPage>("/api/platform/audit?pageSize=100");
        var provisioned = Assert.Single(audit!.Items, i => i.Target == slug);
        Assert.Equal(("organisation.provisioned", slug, "Api"), (provisioned.Action, provisioned.OrganisationSlug, provisioned.Source));
        Assert.Contains($"Joel@{slug}.test", provisioned.Details);
        var applications = factory.Services.CreateScope().ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();
        var web = await applications.FindByClientIdAsync(CommunitySeeder.WebClientId);
        Assert.Contains($"https://app.{slug}.test/auth/callback", await applications.GetRedirectUrisAsync(web!));
    }

    [Fact]
    public async Task Running_the_same_command_again_changes_nothing_and_reports_it_exists()
    {
        var slug = NewSlug();
        var operatorClient = await factory.OperatorClientAsync();
        (await operatorClient.PostAsJsonAsync("/api/platform/organisations", Command(slug))).EnsureSuccessStatusCode();

        var again = await operatorClient.PostAsJsonAsync("/api/platform/organisations", Command(slug));

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        var organisation = (await FindAsync(slug))!;
        Assert.Equal((2, 1), await factory.WithDbAsync(organisation.Id, async db => (await db.RoleDefinitions.CountAsync(), await db.Invites.CountAsync())));
        var audit = await operatorClient.GetFromJsonAsync<AuditPage>("/api/platform/audit?pageSize=100");
        Assert.Single(audit!.Items, i => i.Target == slug);
    }

    [Fact]
    public async Task The_same_slug_with_different_fields_is_a_conflict()
    {
        var slug = NewSlug();
        var operatorClient = await factory.OperatorClientAsync();
        (await operatorClient.PostAsJsonAsync("/api/platform/organisations", Command(slug))).EnsureSuccessStatusCode();

        var response = await operatorClient.PostAsJsonAsync("/api/platform/organisations", Command(slug, name: "Riverside Fellowship"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("Riverside Church", (await FindAsync(slug))!.Name);
    }

    [Fact]
    public async Task A_host_already_in_use_is_refused_and_nothing_is_created()
    {
        var slug = NewSlug();
        var taken = (await FindAsync("faithtech"))!.Host;
        var operatorClient = await factory.OperatorClientAsync();

        var response = await operatorClient.PostAsJsonAsync("/api/platform/organisations", new
        {
            Slug = slug,
            Host = taken.ToUpperInvariant(),
            Name = "Copycat",
            ShortName = "Copy",
            AdminEmail = "x@example.org",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Host", (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.Keys);
        Assert.Null(await FindAsync(slug));
    }

    [Theory]
    [InlineData("Slug", "ab")]
    [InlineData("Slug", "Has-Caps")]
    [InlineData("Slug", "under_score")]
    [InlineData("Slug", "-leading")]
    [InlineData("Host", "")]
    [InlineData("Host", "not a host")]
    [InlineData("Name", "")]
    [InlineData("ShortName", "")]
    [InlineData("AdminEmail", "not-an-email")]
    public async Task An_invalid_field_is_400_and_nothing_is_created(string field, string value)
    {
        var slug = NewSlug();
        var body = new Dictionary<string, object?>
        {
            ["Slug"] = slug,
            ["Host"] = $"app.{slug}.test",
            ["Name"] = "Riverside Church",
            ["ShortName"] = "Riverside",
            ["AdminEmail"] = $"admin@{slug}.test",
        };
        body[field] = value;
        var operatorClient = await factory.OperatorClientAsync();

        var response = await operatorClient.PostAsJsonAsync("/api/platform/organisations", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(field, (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.Keys);
        Assert.Null(await FindAsync(slug));
        Assert.Null(await FindAsync(value));
    }

    [Fact]
    public async Task Lengths_and_labels_are_checked()
    {
        var slug = NewSlug();
        var operatorClient = await factory.OperatorClientAsync();

        async Task<string[]> Errors(object body) =>
            [.. (await (await operatorClient.PostAsJsonAsync("/api/platform/organisations", body)).Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.Keys];

        Assert.Contains("Name", await Errors(new { Slug = slug, Host = $"app.{slug}.test", Name = new string('a', 101), ShortName = "R", AdminEmail = "a@b.org" }));
        Assert.Contains("ShortName", await Errors(new { Slug = slug, Host = $"app.{slug}.test", Name = "R", ShortName = new string('a', 31), AdminEmail = "a@b.org" }));
        Assert.Contains(
            "ChapterLabel.Plural",
            await Errors(new { Slug = slug, Host = $"app.{slug}.test", Name = "R", ShortName = "R", AdminEmail = "a@b.org", ChapterLabel = new { Singular = "Campus" } }));
        Assert.Null(await FindAsync(slug));
    }

    [Fact]
    public async Task The_first_administrator_accepts_on_the_new_host_and_can_open_the_organisation_section()
    {
        var slug = NewSlug();
        var adminEmail = $"joel@{slug}.test";
        var operatorClient = await factory.OperatorClientAsync();
        (await operatorClient.PostAsJsonAsync("/api/platform/organisations", Command(slug, adminEmail))).EnsureSuccessStatusCode();
        var organisation = (await FindAsync(slug))!;
        var token = InviteClients.TokenFrom(Assert.Single(await factory.QueuedEmailsToAsync(organisation.Id, adminEmail)).Body);
        var flow = new OidcFlow(factory, $"https://app.{slug}.test");

        var accept = await flow.Browser.PostAsJsonAsync("/api/invites/accept", new { Token = token, Name = "Joel Mwangi", Password = OidcFlow.Password });
        accept.EnsureSuccessStatusCode();
        await factory.WithDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Email == adminEmail)).EmailConfirmed = true;
            return await db.SaveChangesAsync();
        });
        var tokens = await flow.SignInAndGetTokensAsync(adminEmail);
        var api = factory.CreateClient(new() { BaseAddress = new Uri($"https://app.{slug}.test") });
        api.DefaultRequestHeaders.Authorization = new("Bearer", tokens.AccessToken);

        var me = await api.GetFromJsonAsync<JsonElement>("/api/me");
        Assert.Contains(Capability.AdministerOrganisation, me.GetProperty("capabilities").EnumerateArray().Select(c => c.GetString()));
        Assert.Equal(HttpStatusCode.OK, (await api.GetAsync("/api/organisation")).StatusCode);
        var summary = await operatorClient.GetFromJsonAsync<Summary>($"/api/platform/organisations/{slug}");
        Assert.Equal(1, summary!.AdministratorCount);
    }
}
