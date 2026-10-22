// Traces to: L2-095, L2-091 AC7
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class ArchiveNotesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Archived(Guid Id, string Title, string? Icon, DateTimeOffset ArchivedAt);

    [Fact]
    public async Task An_archived_page_disappears_for_readers_and_waits_in_its_owners_Archived()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var owner = factory.ClientFor(grace);
        var playbook = await factory.AddNoteAsync(grace, "Toronto playbook", "Global");
        var sheet = await factory.AddNoteAsync(grace, "Builders Night run sheet", "Global");
        (await owner.SaveNoteAsync(playbook, [Block("paragraph", [PageLink(sheet.Id)])])).EnsureSuccessStatusCode();
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"));

        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/notes/{sheet.Id}/archive", null)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await marcus.GetAsync($"/api/notes/{sheet.Id}")).StatusCode);
        Assert.DoesNotContain((await marcus.ListNotesAsync()).Items, p => p.Id == sheet.Id);
        Assert.DoesNotContain((await owner.ListNotesAsync()).Items, p => p.Id == sheet.Id);
        Assert.Empty((await marcus.GetFromJsonAsync<PageRef[]>("/api/notes/links?q=builders"))!);
        foreach (var reader in new[] { owner, marcus })
        {
            var read = (await reader.GetFromJsonAsync<Detail>($"/api/notes/{playbook.Id}"))!;
            Assert.Equal("Private page", TextOf(read.Blocks[0]!));
        }

        var archived = (await owner.GetFromJsonAsync<Archived[]>("/api/notes/archived"))!;
        Assert.Equal(["Builders Night run sheet"], archived.Select(a => a.Title));
        Assert.Empty((await marcus.GetFromJsonAsync<Archived[]>("/api/notes/archived"))!);
        var own = (await owner.GetFromJsonAsync<Detail>($"/api/notes/{sheet.Id}"))!;
        Assert.NotNull(own.ArchivedAt);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.SaveNoteAsync(own, [Paragraph("Edit")])).StatusCode);
    }

    [Fact]
    public async Task Restoring_brings_it_back_as_it_was()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var owner = factory.ClientFor(grace);
        var page = await owner.CreateNoteAsync("Q4 planning notes");
        (await owner.SaveNoteAsync(page, [Paragraph("Budget first")])).EnsureSuccessStatusCode();
        await factory.ShareInDbAsync(page.Id, [hannah.ProfileId], []);
        await owner.PostAsync($"/api/notes/{page.Id}/archive", null);

        Assert.Equal(HttpStatusCode.NoContent, (await owner.PostAsync($"/api/notes/{page.Id}/restore", null)).StatusCode);

        var read = (await factory.ClientFor(hannah).GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;
        Assert.Equal(("Shared", "Budget first", (DateTimeOffset?)null, page.Version + 1), (read.Visibility, TextOf(read.Blocks[0]!), read.ArchivedAt, read.Version));
    }

    [Fact]
    public async Task Only_the_owner_archives_and_restores_and_children_stay_where_they_are()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var owner = factory.ClientFor(grace);
        var playbook = await factory.AddNoteAsync(grace, "Playbook", "Global");
        var child = await owner.CreateNoteAsync("Run sheet", playbook.Id);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Esther Nakamura"), Role.Staff);

        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PostAsync($"/api/notes/{playbook.Id}/archive", null)).StatusCode);
        await owner.PostAsync($"/api/notes/{playbook.Id}/archive", null);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.PostAsync($"/api/notes/{playbook.Id}/restore", null)).StatusCode);

        var kept = (await owner.GetFromJsonAsync<Detail>($"/api/notes/{child.Id}"))!;
        Assert.Equal(playbook.Id, kept.ParentId);
        Assert.Equal([new PageRef(null, "Private page", null)], kept.Breadcrumb);
    }
}
