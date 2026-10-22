// Traces to: L2-085 AC7, L2-091
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class NestingTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_page_created_inside_another_shows_its_breadcrumb_and_is_listed_inside()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var playbook = await client.CreateNoteAsync("Toronto city team playbook");
        var sheet = await client.CreateNoteAsync("Builders Night run sheet", playbook.Id);
        var rota = await client.CreateNoteAsync("Door rota", sheet.Id);

        var read = (await client.GetFromJsonAsync<Detail>($"/api/notes/{rota.Id}"))!;
        var parent = (await client.GetFromJsonAsync<Detail>($"/api/notes/{playbook.Id}"))!;
        var row = (await client.ListNotesAsync()).Items.Single(p => p.Id == sheet.Id);

        Assert.Equal([playbook.Id, sheet.Id], read.Breadcrumb.Select(b => b.Id));
        Assert.Equal(["Builders Night run sheet"], parent.Children.Select(c => c.Title));
        Assert.Equal("Toronto city team playbook", row.ParentTitle);
    }

    [Fact]
    public async Task An_ancestor_the_reader_cannot_open_reads_Private_page_without_an_id()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var plans = await client.CreateNoteAsync("Grace’s private plans");
        var shared = await client.CreateNoteAsync("Partner meeting notes", plans.Id);
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        await factory.ShareInDbAsync(shared.Id, [marcus.ProfileId], []);

        var json = await factory.ClientFor(marcus).GetStringAsync($"/api/notes/{shared.Id}");
        var read = (await factory.ClientFor(marcus).GetFromJsonAsync<Detail>($"/api/notes/{shared.Id}"))!;

        Assert.Equal([new PageRef(null, "Private page", null)], read.Breadcrumb);
        Assert.DoesNotContain("private plans", json);
        Assert.Equal("Private page", (await factory.ClientFor(marcus).ListNotesAsync()).Items.Single(p => p.Id == shared.Id).ParentTitle);
    }

    [Fact]
    public async Task Children_the_reader_cannot_open_are_neither_named_nor_counted()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var playbook = await factory.AddNoteAsync(grace, "Playbook", "Global");
        await client.CreateNoteAsync("Private child", playbook.Id);
        var open = await client.CreateNoteAsync("Open child", playbook.Id);
        await factory.WithDbAsync(async db =>
        {
            (await db.NotePages.FindAsync(open.Id))!.SetAudience(Domain.Notes.NoteVisibility.Global, [], []);
            return await db.SaveChangesAsync();
        });

        var read = (await factory.ClientFor(await factory.AddMemberAsync("Marcus Lee")).GetFromJsonAsync<Detail>($"/api/notes/{playbook.Id}"))!;

        Assert.Equal(["Open child"], read.Children.Select(c => c.Title));
    }

    [Fact]
    public async Task A_page_can_only_be_put_inside_a_page_of_the_same_owner()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var theirs = await factory.AddNoteAsync(hannah, "Hannah’s playbook", "Global");
        var client = factory.ClientFor(grace);
        var mine = await client.CreateNoteAsync("Run sheet");

        var create = await client.PostAsJsonAsync("/api/notes", new { ParentId = theirs.Id });
        var move = await client.PutAsJsonAsync($"/api/notes/{mine.Id}/parent", new { ParentId = theirs.Id });
        var hidden = await client.PostAsJsonAsync("/api/notes", new { ParentId = (await factory.AddNoteAsync(hannah, "Secret")).Id });

        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, move.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, hidden.StatusCode);
    }

    [Fact]
    public async Task Moving_under_itself_or_a_descendant_is_refused_and_top_level_is_allowed()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var top = await client.CreateNoteAsync("Playbook");
        var child = await client.CreateNoteAsync("Run sheet", top.Id);
        var grandchild = await client.CreateNoteAsync("Door rota", child.Id);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"/api/notes/{top.Id}/parent", new { ParentId = top.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"/api/notes/{top.Id}/parent", new { ParentId = grandchild.Id })).StatusCode);

        var moved = await client.PutAsJsonAsync($"/api/notes/{grandchild.Id}/parent", new { ParentId = (Guid?)null });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Null((await moved.Content.ReadFromJsonAsync<Detail>())!.ParentId);

        var options = (await client.GetFromJsonAsync<PageRef[]>($"/api/notes/{top.Id}/parent-options"))!;
        Assert.DoesNotContain(options, o => o.Id == top.Id || o.Id == child.Id);
        Assert.Contains(options, o => o.Id == grandchild.Id);
    }

    [Fact]
    public async Task Someone_who_can_read_a_page_cannot_move_it()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.AddNoteAsync(grace, "Playbook", "Global");
        var marcus = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"));

        var response = await marcus.PutAsJsonAsync($"/api/notes/{page.Id}/parent", new { ParentId = (Guid?)null });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
