// Traces to: L2-086, L2-092 AC6
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class SaveNoteTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_owner_saves_the_title_and_blocks_in_order_and_gets_the_next_version()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var page = await client.CreateNoteAsync();

        var response = await client.SaveNoteAsync(page, [Paragraph("Doors open at 6", "b1"), Paragraph("Pizza at 6:30", "b2")], title: "Builders Night run sheet");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = (await response.Content.ReadFromJsonAsync<Saved>())!;
        Assert.Equal(page.Version + 1, saved.Version);
        var read = (await client.GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;
        Assert.Equal(("Builders Night run sheet", saved.Version), (read.Title, read.Version));
        Assert.Equal(["b1", "b2"], read.Blocks.Select(b => b!["id"]!.GetValue<string>()));
        Assert.Equal("Doors open at 6", TextOf(read.Blocks[0]!));
        Assert.Equal("Grace Okonkwo", read.UpdatedByName);
    }

    [Fact]
    public async Task A_save_moves_the_page_to_the_top_of_the_list()
    {
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var client = factory.ClientFor(hannah);
        var older = await client.CreateNoteAsync("Volunteer onboarding checklist");
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        await client.CreateNoteAsync("Builders Night run sheet");
        factory.Time.Advance(TimeSpan.FromMinutes(1));

        (await client.SaveNoteAsync(older, [Paragraph("Send the welcome email")])).EnsureSuccessStatusCode();

        Assert.Equal("Volunteer onboarding checklist", (await client.ListNotesAsync("?owner=mine")).Items[0].Title);
    }

    [Fact]
    public async Task Someone_who_can_read_the_page_but_does_not_own_it_cannot_save_it()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.AddNoteAsync(grace, "Toronto city team playbook", "Global");
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), Role.CityLead);
        var esther = factory.ClientFor(await factory.AddMemberAsync("Esther Nakamura"), Role.Staff);

        var read = (await marcus.GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;

        Assert.False(read.CanEdit);
        Assert.Equal(HttpStatusCode.Forbidden, (await marcus.SaveNoteAsync(page, [Paragraph("Mine now")])).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await esther.SaveNoteAsync(page, [Paragraph("Mine now")])).StatusCode);
    }

    [Theory]
    [InlineData("too-many-blocks")]
    [InlineData("long-text")]
    [InlineData("unknown-type")]
    [InlineData("duplicate-ids")]
    [InlineData("long-title")]
    public async Task A_save_over_the_limits_is_refused_and_nothing_changes(string problem)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var page = await client.CreateNoteAsync("Run sheet");
        object[] blocks = problem switch
        {
            "too-many-blocks" => [.. Enumerable.Range(0, 501).Select(i => Paragraph($"Line {i}"))],
            "long-text" => [Paragraph(new string('a', 10_001))],
            "unknown-type" => [Block("table", [new { Text = "x" }])],
            "duplicate-ids" => [Paragraph("One", "same"), Paragraph("Two", "same")],
            _ => [Paragraph("Fine")],
        };

        var response = await client.SaveNoteAsync(page, blocks, title: problem == "long-title" ? new string('t', 201) : null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var read = (await client.GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;
        Assert.Equal((page.Version, 0), (read.Version, read.Blocks.Count));
    }

    [Fact]
    public async Task A_page_of_500_blocks_can_be_saved()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Long page");

        var response = await client.SaveNoteAsync(page, [.. Enumerable.Range(0, 500).Select(i => Paragraph($"Line {i}"))]);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
