// Traces to: L2-152 AC2, AC3; L2-041 AC2, AC4, AC5
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// The organisation's settings history on the audit log: its categories, summaries, export and who may read which part.
public class OrganisationAuditTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Item(string Action, string Summary);

    public sealed record Page(List<Item> Items, int TotalCount);

    public sealed record Created(Guid Id);

    private sealed record Fresh(OrganisationScopes.OtherOrganisation Organisation, HttpClient Admin);

    // A fresh organisation, so its audit holds only what the test does; chapters are on, called Campus / Campuses.
    private async Task<Fresh> FreshAsync()
    {
        var organisation = await factory.AddOrganisationAsync($"au-{Guid.NewGuid():N}"[..10]);
        var admin = factory.ClientOn(organisation, await factory.AddMemberAsync(organisation, "Priya Shah", Role.SystemAdmin));
        (await admin.PutAsJsonAsync("/api/organisation", new
        {
            Name = "Northside Church",
            ShortName = "Northside",
            ChapterLabel = new { Singular = "Campus", Plural = "Campuses" },
        })).EnsureSuccessStatusCode();
        return new Fresh(organisation, admin);
    }

    // A member of the organisation who holds a role carrying exactly these capabilities.
    private async Task<HttpClient> HolderAsync(Fresh fresh, string name, params string[] capabilities)
    {
        var member = await factory.AddMemberAsync(fresh.Organisation, name);
        await factory.WithDbAsync(fresh.Organisation.Id, async db =>
        {
            var definition = new RoleDefinition(Guid.NewGuid(), $"test-{Guid.NewGuid():N}", $"Test {Guid.NewGuid():N}"[..20], "", capabilities, 100);
            db.RoleDefinitions.Add(definition);
            var profile = await db.Profiles.SingleAsync(p => p.Id == member.ProfileId);
            profile.AddRole(definition, Guid.Empty, DateTime.UtcNow);
            return await db.SaveChangesAsync();
        });
        return factory.ClientOn(fresh.Organisation, member);
    }

    // Each change a minute after the last, so the audit's newest-first order is the order of the test.
    private async Task DoAsync(Func<Task<HttpResponseMessage>> send)
    {
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        (await send()).EnsureSuccessStatusCode();
    }

    private async Task<Guid> CreateAsync(HttpClient client, string path, object body)
    {
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        var response = await client.PostAsJsonAsync(path, body);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Created>())!.Id;
    }

    private static async Task<List<string>> SummariesAsync(HttpClient client, string category) =>
        [.. (await client.GetFromJsonAsync<Page>($"/api/admin/audit?category={category}"))!.Items.Select(i => i.Summary)];

    [Fact]
    public async Task Organisation_category_holds_the_general_settings_with_one_line_each()
    {
        var fresh = await FreshAsync();
        await DoAsync(() => fresh.Admin.PutAsJsonAsync("/api/organisation", new
        {
            Name = "Northside Church",
            ShortName = "Northside Ch",
            ChapterLabel = new { Singular = "Campus", Plural = "Campuses" },
        }));
        await DoAsync(() => fresh.Admin.PutAsJsonAsync("/api/organisation", new { Name = "Northside Community", ShortName = "Northside Ch" }));

        var summaries = await SummariesAsync(fresh.Admin, "organisation");

        Assert.Equal(
            [
                "Renamed the organisation from Northside Church to Northside Community; turned campuses off",
                "Changed the short name from Northside to Northside Ch",
            ],
            summaries.Take(2));
        Assert.EndsWith("; turned campuses on, called Campus / Campuses", summaries[2]);
    }

    [Fact]
    public async Task Chapters_category_holds_added_renamed_reordered_and_archived_chapters()
    {
        var fresh = await FreshAsync();
        var eastgate = await CreateAsync(fresh.Admin, "/api/organisation/chapters", new { Name = "Eastgate" });
        var westgate = await CreateAsync(fresh.Admin, "/api/organisation/chapters", new { Name = "Westgate" });
        await DoAsync(() => fresh.Admin.PutAsJsonAsync($"/api/organisation/chapters/{eastgate}", new { Name = "Eastgate Hall" }));
        await DoAsync(() => fresh.Admin.PutAsJsonAsync("/api/organisation/chapters/order", new { ChapterIds = new[] { westgate, eastgate } }));
        await DoAsync(() => fresh.Admin.PostAsync($"/api/organisation/chapters/{westgate}/archive", null));

        var summaries = await SummariesAsync(fresh.Admin, "chapters");

        Assert.Equal(
            [
                "Archived the campus Westgate",
                "Reordered the campuses",
                "Renamed Eastgate to Eastgate Hall",
                "Added the campus Westgate",
                "Added the campus Eastgate",
            ],
            summaries);
    }

    [Fact]
    public async Task Roles_category_holds_definitions_and_grant_rules_beside_role_changes()
    {
        var fresh = await FreshAsync();
        var role = await CreateAsync(fresh.Admin, "/api/organisation/roles", new
        {
            Name = "Meet-up Lead", Description = "Runs meet-ups.", Capabilities = new[] { Capability.ManageEvents }, ShowOnTeam = true, IsOversight = false,
        });
        var helper = await CreateAsync(fresh.Admin, "/api/organisation/roles", new
        {
            Name = "Greeter", Description = "", Capabilities = Array.Empty<string>(), ShowOnTeam = false, IsOversight = false,
        });
        await DoAsync(() => fresh.Admin.PutAsJsonAsync($"/api/organisation/roles/{role}", new
        {
            Name = "Meetup Lead", Description = "Runs meet-ups.", Capabilities = new[] { Capability.ManageEvents }, ShowOnTeam = true, IsOversight = false,
        }));
        await DoAsync(() => fresh.Admin.PutAsJsonAsync($"/api/organisation/roles/{role}/grants", new { GrantableRoleIds = new[] { helper } }));
        await DoAsync(() => fresh.Admin.PutAsJsonAsync($"/api/organisation/roles/{role}/grants", new { GrantableRoleIds = Array.Empty<Guid>() }));
        await DoAsync(() => fresh.Admin.PostAsync($"/api/organisation/roles/{helper}/archive", null));

        var summaries = await SummariesAsync(fresh.Admin, "roles");

        Assert.Equal(
            [
                "Archived the role Greeter",
                "Changed who Meetup Lead may grant: removed Greeter",
                "Changed who Meetup Lead may grant: added Greeter",
                "Renamed the role Meet-up Lead to Meetup Lead",
                "Defined the role Greeter",
                "Defined the role Meet-up Lead",
            ],
            summaries.Take(6));
    }

    [Fact]
    public async Task Taxonomies_category_holds_stages_and_types()
    {
        var fresh = await FreshAsync();
        var stage = await CreateAsync(fresh.Admin, "/api/organisation/partner-stages", new { Name = "Proposal sent" });
        await DoAsync(() => fresh.Admin.PutAsJsonAsync($"/api/organisation/partner-stages/{stage}", new { IsInitial = true }));
        await DoAsync(() => fresh.Admin.PutAsJsonAsync($"/api/organisation/partner-stages/{stage}", new { Kind = "Confirmed" }));
        var outreach = await CreateAsync(fresh.Admin, "/api/organisation/event-types", new { Name = "Outreach" });
        await DoAsync(() => fresh.Admin.PutAsJsonAsync($"/api/organisation/event-types/{outreach}", new { Name = "Street outreach" }));
        await DoAsync(() => fresh.Admin.PostAsync($"/api/organisation/event-types/{outreach}/archive", null));
        await CreateAsync(fresh.Admin, "/api/organisation/resource-types", new { Name = "Sermon notes" });

        var summaries = await SummariesAsync(fresh.Admin, "taxonomies");

        Assert.Equal(
            [
                "Added the resource type Sermon notes",
                "Archived the event type Street outreach",
                "Renamed the event type Outreach to Street outreach",
                "Added the event type Outreach",
                "Made Proposal sent count as confirmed",
                "Set Proposal sent as the initial partner stage",
                "Added the partner stage Proposal sent",
            ],
            summaries);
    }

    [Fact]
    public async Task Reordering_a_list_says_which_list()
    {
        var fresh = await FreshAsync();
        var types = (await fresh.Admin.GetFromJsonAsync<List<Created>>("/api/organisation/event-types"))!;
        await DoAsync(() => fresh.Admin.PutAsJsonAsync("/api/organisation/event-types/order", new { Ids = types.Select(t => t.Id).Reverse() }));

        Assert.Equal("Reordered the event types", (await SummariesAsync(fresh.Admin, "taxonomies"))[0]);
    }

    [Fact]
    public async Task Export_includes_the_settings_categories()
    {
        var fresh = await FreshAsync();
        await CreateAsync(fresh.Admin, "/api/organisation/chapters", new { Name = "Eastgate" });

        var csv = await (await fresh.Admin.GetAsync("/api/admin/audit/export?category=chapters")).Content.ReadAsStringAsync();

        var lines = csv.TrimEnd().Split('\n');
        Assert.Equal(2, lines.Length);
        Assert.Contains("chapter.added,Added the campus Eastgate", lines[1]);
    }
}
