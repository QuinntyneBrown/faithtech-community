// Traces to: L2-090, L2-092 AC1
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class NoteLinksTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_page_link_shows_the_targets_current_title_whatever_text_was_saved()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var sheet = await client.CreateNoteAsync("Builders Night run sheet");
        var playbook = await client.CreateNoteAsync("Playbook");

        (await client.SaveNoteAsync(playbook, [Block("paragraph", [new { Text = "See " }, PageLink(sheet.Id, "Made-up title")])])).EnsureSuccessStatusCode();
        (await client.SaveNoteAsync(sheet, [], title: "Builders Night run sheet v2")).EnsureSuccessStatusCode();

        var read = (await client.GetFromJsonAsync<Detail>($"/api/notes/{playbook.Id}"))!;
        Assert.Equal("See Builders Night run sheet v2", TextOf(read.Blocks[0]!));
        Assert.Contains(read.Links, l => l.Id == sheet.Id && l.Title == "Builders Night run sheet v2");
    }

    [Fact]
    public async Task A_link_to_a_page_the_reader_cannot_open_reads_Private_page_and_never_leaks_its_title()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var retro = await factory.AddNoteAsync(hannah, "Austin launch retro notes");
        await factory.ShareInDbAsync(retro.Id, [grace.ProfileId], []);
        var playbook = await factory.AddNoteAsync(grace, "Playbook", "Global");
        (await factory.ClientFor(grace).SaveNoteAsync(playbook, [Block("paragraph", [new { Text = "Read " }, PageLink(retro.Id)])])).EnsureSuccessStatusCode();
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead);

        var json = await marcus.GetStringAsync($"/api/notes/{playbook.Id}");
        var read = (await marcus.GetFromJsonAsync<Detail>($"/api/notes/{playbook.Id}"))!;

        Assert.DoesNotContain("Austin launch retro", json);
        Assert.Equal("Read Private page", TextOf(read.Blocks[0]!));
        Assert.Equal(retro.Id.ToString(), read.Blocks[0]!["text"]![1]!["pageId"]!.GetValue<string>());
        Assert.Empty(read.Links);
    }

    [Fact]
    public async Task A_new_link_must_point_at_a_page_the_saver_can_open()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var secret = await factory.AddNoteAsync(await factory.AddMemberAsync("Hannah Kim"), "Hannah’s private draft");
        var client = factory.ClientFor(grace);
        var playbook = await client.CreateNoteAsync("Playbook");

        var hidden = await client.SaveNoteAsync(playbook, [Block("paragraph", [PageLink(secret.Id)])]);
        var missing = await client.SaveNoteAsync(playbook, [Block("paragraph", [PageLink(Guid.NewGuid())])]);

        Assert.Equal(HttpStatusCode.BadRequest, hidden.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Equal(
            (await hidden.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors,
            (await missing.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors);
    }

    [Fact]
    public async Task Linked_from_lists_only_the_linking_pages_the_reader_can_open_and_follows_saves()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var checklist = await factory.AddNoteAsync(grace, "Volunteer onboarding checklist", "Global");
        var open = await factory.AddNoteAsync(grace, "Toronto playbook", "Global");
        var hidden = await factory.AddNoteAsync(hannah, "Hannah’s private plan");
        (await factory.ClientFor(grace).SaveNoteAsync(open, [Block("paragraph", [PageLink(checklist.Id)])])).EnsureSuccessStatusCode();
        (await factory.ClientFor(hannah).SaveNoteAsync(hidden, [Block("paragraph", [PageLink(checklist.Id)])])).EnsureSuccessStatusCode();
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"));

        var seen = (await marcus.GetFromJsonAsync<Detail>($"/api/notes/{checklist.Id}"))!;
        Assert.Equal(["Toronto playbook"], seen.Backlinks.Select(b => b.Title));

        var withLink = (await factory.ClientFor(grace).GetFromJsonAsync<Detail>($"/api/notes/{open.Id}"))!;
        (await factory.ClientFor(grace).SaveNoteAsync(withLink, [Paragraph("No link now")])).EnsureSuccessStatusCode();
        Assert.Empty((await marcus.GetFromJsonAsync<Detail>($"/api/notes/{checklist.Id}"))!.Backlinks);
    }

    [Fact]
    public async Task Suggestions_list_only_visible_pages_by_title_without_the_current_one()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var client = factory.ClientFor(grace);
        var current = await client.CreateNoteAsync("Builders Night run sheet");
        await client.CreateNoteAsync("Builders Night budget");
        await factory.AddNoteAsync(hannah, "Builders Night private notes");
        await factory.AddNoteAsync(hannah, "Builders Night shared plan", "Global");

        var found = (await client.GetFromJsonAsync<PageRef[]>($"/api/notes/links?q=builders&exclude={current.Id}"))!;

        Assert.Equal(["Builders Night budget", "Builders Night shared plan"], found.Select(f => f.Title).Order());
    }
}
