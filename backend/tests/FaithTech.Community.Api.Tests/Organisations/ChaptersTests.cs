// Traces to: L2-140 AC1, AC2, AC3, AC4, AC5, AC6, AC7; L2-152 AC1
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// The chapter label on General and the Chapters tab's list: add, rename, reorder and archive.
public class ChaptersTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record ChapterOption(Guid Id, string Name);

    public sealed record Label(string Singular, string Plural);

    public sealed record OrganisationView(Label? ChapterLabel, ChapterOption[] Chapters);

    public sealed record Chapter(Guid Id, string Name, int SortOrder, bool Archived, int MemberCount);

    private async Task<HttpClient> SettingsManagerAsync() =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageOrganisationSettings);

    private async Task<(HttpClient Client, Guid OrganisationId)> FreshOrganisationAsync(bool chapters = true)
    {
        var organisation = await factory.AddOrganisationAsync($"ch-{Guid.NewGuid():N}"[..10]);
        var member = await factory.AddMemberAsync(organisation, "Grace Okonkwo", Role.SystemAdmin);
        var client = factory.ClientOn(organisation, member);
        if (chapters)
        {
            (await client.PutAsJsonAsync("/api/organisation", new
            {
                Name = "Northside Church",
                ShortName = "Northside",
                ChapterLabel = new { Singular = "Campus", Plural = "Campuses" },
            })).EnsureSuccessStatusCode();
        }

        return (client, organisation.Id);
    }

    private static async Task<Chapter> AddAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/organisation/chapters", new { Name = name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<Chapter>())!;
    }

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return Assert.Single((await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
    }

    // L2-140 AC1: both labels, trimmed, audited with the names.
    [Fact]
    public async Task Turning_chapters_on_saves_both_labels_and_is_audited()
    {
        var (client, organisationId) = await FreshOrganisationAsync(chapters: false);
        Assert.Null((await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!.ChapterLabel);

        var response = await client.PutAsJsonAsync("/api/organisation", new
        {
            Name = "Northside Church",
            ShortName = "Northside",
            ChapterLabel = new { Singular = " Campus ", Plural = "Campuses" },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new Label("Campus", "Campuses"), (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!.ChapterLabel);
        var entry = await factory.WithDbAsync(organisationId, db => db.AuditEntries.OrderBy(a => a.Id).LastAsync(a => a.Action == "organisation.updated"));
        Assert.Contains("Campuses", entry.AfterJson);
    }

    [Fact]
    public async Task A_label_needs_both_forms_of_up_to_30_characters()
    {
        var (client, _) = await FreshOrganisationAsync(chapters: false);

        var response = await client.PutAsJsonAsync("/api/organisation", new
        {
            Name = "Northside Church",
            ShortName = "Northside",
            ChapterLabel = new { Singular = "Campus", Plural = " " },
        });
        Assert.Equal("Enter the plural label too.", await FieldErrorAsync(response, "ChapterLabel.Plural"));

        response = await client.PutAsJsonAsync("/api/organisation", new
        {
            Name = "Northside Church",
            ShortName = "Northside",
            ChapterLabel = new { Singular = new string('a', 31), Plural = "Campuses" },
        });
        Assert.Equal("Use 30 characters or fewer for the singular label.", await FieldErrorAsync(response, "ChapterLabel.Singular"));
    }

    // L2-140 AC2, AC6: off clears only the label; the chapters come back with it.
    [Fact]
    public async Task Turning_chapters_off_hides_them_and_keeps_them()
    {
        var (client, _) = await FreshOrganisationAsync();
        await AddAsync(client, "Downtown");

        (await client.PutAsJsonAsync("/api/organisation", new { Name = "Northside Church", ShortName = "Northside", ChapterLabel = (object?)null }))
            .EnsureSuccessStatusCode();

        var off = await client.GetFromJsonAsync<OrganisationView>("/api/organisation");
        Assert.Null(off!.ChapterLabel);
        Assert.Empty(off.Chapters);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/organisation/chapters", new { Name = "Riverside" })).StatusCode);

        (await client.PutAsJsonAsync("/api/organisation", new
        {
            Name = "Northside Church",
            ShortName = "Northside",
            ChapterLabel = new { Singular = "Campus", Plural = "Campuses" },
        })).EnsureSuccessStatusCode();
        Assert.Equal(["Downtown"], (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!.Chapters.Select(c => c.Name));
    }

    // L2-140 AC3: added at the end, listed in order for the tab and for every member's pickers.
    [Fact]
    public async Task Chapters_are_added_at_the_end_and_every_member_reads_them_in_order()
    {
        var (client, _) = await FreshOrganisationAsync();

        var downtown = await AddAsync(client, " Downtown ");
        var riverside = await AddAsync(client, "Riverside");

        Assert.Equal("Downtown", downtown.Name);
        Assert.True(riverside.SortOrder > downtown.SortOrder);
        var list = await client.GetFromJsonAsync<Chapter[]>("/api/organisation/chapters");
        Assert.Equal(["Downtown", "Riverside"], list!.Select(c => c.Name));
        Assert.All(list!, c => Assert.Equal(0, c.MemberCount));
        Assert.Equal(
            [new ChapterOption(downtown.Id, "Downtown"), new ChapterOption(riverside.Id, "Riverside")],
            (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!.Chapters);
    }

    // L2-140 AC4.
    [Fact]
    public async Task A_name_that_is_empty_too_long_or_taken_is_400_and_nothing_is_saved()
    {
        var (client, _) = await FreshOrganisationAsync();
        await AddAsync(client, "Downtown");

        Assert.Equal("Enter a name.", await FieldErrorAsync(await client.PostAsJsonAsync("/api/organisation/chapters", new { Name = " " }), "Name"));
        Assert.Equal(
            "Use 60 characters or fewer for the name.",
            await FieldErrorAsync(await client.PostAsJsonAsync("/api/organisation/chapters", new { Name = new string('a', 61) }), "Name"));
        Assert.Equal(
            "There’s already a campus called downtown.",
            await FieldErrorAsync(await client.PostAsJsonAsync("/api/organisation/chapters", new { Name = "downtown" }), "Name"));
        Assert.Single((await client.GetFromJsonAsync<Chapter[]>("/api/organisation/chapters"))!);
    }

    [Fact]
    public async Task A_chapter_is_renamed_and_audited()
    {
        var (client, organisationId) = await FreshOrganisationAsync();
        var downtown = await AddAsync(client, "Downtown");
        var riverside = await AddAsync(client, "Riverside");

        Assert.Equal(
            "There’s already a campus called Riverside.",
            await FieldErrorAsync(await client.PutAsJsonAsync($"/api/organisation/chapters/{downtown.Id}", new { Name = "Riverside" }), "Name"));
        var response = await client.PutAsJsonAsync($"/api/organisation/chapters/{downtown.Id}", new { Name = "Downtown East" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Downtown East", (await response.Content.ReadFromJsonAsync<Chapter>())!.Name);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/organisation/chapters/{riverside.Id}", new { Name = "riverside" })).StatusCode);
        var entry = await factory.WithDbAsync(organisationId, db => db.AuditEntries.FirstAsync(a => a.Action == "chapter.updated" && a.TargetId == downtown.Id.ToString()));
        Assert.Contains("Downtown East", entry.AfterJson);
        Assert.Contains("Downtown", entry.BeforeJson);
    }

    [Fact]
    public async Task Chapters_are_reordered_by_the_full_list_of_active_ids()
    {
        var (client, organisationId) = await FreshOrganisationAsync();
        var a = await AddAsync(client, "Downtown");
        var b = await AddAsync(client, "Riverside");
        var c = await AddAsync(client, "West End");

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/organisation/chapters/order", new { ChapterIds = new[] { c.Id, a.Id } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/organisation/chapters/order", new { ChapterIds = new[] { c.Id, a.Id, a.Id } })).StatusCode);
        var response = await client.PutAsJsonAsync("/api/organisation/chapters/order", new { ChapterIds = new[] { c.Id, a.Id, b.Id } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["West End", "Downtown", "Riverside"], (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!.Chapters.Select(x => x.Name));
        Assert.True(await factory.WithDbAsync(organisationId, db => db.AuditEntries.AnyAsync(x => x.Action == "chapter.reordered")));
    }

    // L2-140 AC5: archived, it leaves the pickers, is listed under Archived and is never deleted; its name is free again.
    [Fact]
    public async Task An_archived_chapter_leaves_every_picker_and_frees_its_name()
    {
        var (client, organisationId) = await FreshOrganisationAsync();
        var downtown = await AddAsync(client, "Downtown");
        await AddAsync(client, "Riverside");

        var response = await client.PostAsync($"/api/organisation/chapters/{downtown.Id}/archive", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["Riverside"], (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!.Chapters.Select(x => x.Name));
        Assert.Equal(["Riverside"], (await client.GetFromJsonAsync<Chapter[]>("/api/organisation/chapters"))!.Select(x => x.Name));
        var archived = await client.GetFromJsonAsync<Chapter[]>("/api/organisation/chapters?archived=true");
        Assert.True(Assert.Single(archived!).Archived);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"/api/organisation/chapters/{downtown.Id}", new { Name = "Again" })).StatusCode);
        await AddAsync(client, "Downtown");
        Assert.True(await factory.WithDbAsync(organisationId, db => db.AuditEntries.AnyAsync(x => x.Action == "chapter.archived" && x.TargetId == downtown.Id.ToString())));
    }

    // L2-140 AC7, L2-147 AC2: writes need ManageOrganisationSettings; ManageRoles reads the tab.
    [Fact]
    public async Task Only_a_settings_manager_changes_chapters()
    {
        var manager = await SettingsManagerAsync();
        var rolesOnly = factory.ClientWithCapabilities(await factory.AddMemberAsync("Ruth Alvarez"), Capability.ManageRoles);
        var member = factory.ClientFor(await factory.AddMemberAsync("Ama Volunteer"));
        var chapter = await AddAsync(manager, $"Hamilton {Guid.NewGuid():N}"[..14]);

        Assert.Equal(HttpStatusCode.OK, (await rolesOnly.GetAsync("/api/organisation/chapters")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync("/api/organisation/chapters")).StatusCode);
        foreach (var client in new[] { rolesOnly, member })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/organisation/chapters", new { Name = "Nope" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"/api/organisation/chapters/{chapter.Id}", new { Name = "Nope" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync("/api/organisation/chapters/order", new { ChapterIds = new[] { chapter.Id } })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"/api/organisation/chapters/{chapter.Id}/archive", null)).StatusCode);
        }

        Assert.Equal(HttpStatusCode.OK, (await member.GetAsync("/api/organisation")).StatusCode);
    }

    [Fact]
    public async Task Another_organisations_chapters_are_neither_listed_nor_found()
    {
        var (theirs, _) = await FreshOrganisationAsync();
        var their = await AddAsync(theirs, "Their Campus");
        var (ours, _) = await FreshOrganisationAsync();

        Assert.Empty((await ours.GetFromJsonAsync<Chapter[]>("/api/organisation/chapters"))!);
        Assert.Equal(HttpStatusCode.NotFound, (await ours.PutAsJsonAsync($"/api/organisation/chapters/{their.Id}", new { Name = "Mine" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ours.PostAsync($"/api/organisation/chapters/{their.Id}/archive", null)).StatusCode);
        await AddAsync(ours, "Their Campus");
    }
}
