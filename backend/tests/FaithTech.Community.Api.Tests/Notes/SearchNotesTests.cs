// Traces to: L2-096
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;
using static FaithTech.Community.Api.Tests.Search.GlobalSearchTests;

namespace FaithTech.Community.Api.Tests.Notes;

public class SearchNotesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Word() => "kestrel" + Guid.NewGuid().ToString("N")[..8];

    private static async Task<Item[]> NotesFoundAsync(HttpClient client, string term)
    {
        var results = (await client.GetFromJsonAsync<Results>($"/api/search?q={Uri.EscapeDataString(term)}"))!;
        return results.Groups.SingleOrDefault(g => g.Kind == "Note")?.Items ?? [];
    }

    [Fact]
    public async Task Pages_matching_by_title_or_text_are_grouped_with_owner_and_badge()
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var marcus = await factory.AddMemberAsync("Marcus Lee");
        var byTitle = await factory.AddNoteAsync(grace, $"Booking {word} for Builders Night", "Global");
        var byText = await factory.AddNoteAsync(marcus, "Run sheet", "Global");
        (await factory.ClientFor(marcus).SaveNoteAsync(byText, [Paragraph($"Confirm the room with {word} labs")])).EnsureSuccessStatusCode();
        var shared = await factory.AddNoteAsync(marcus, $"{word} contract notes");
        await factory.ShareInDbAsync(shared.Id, [grace.ProfileId], []);

        var found = await NotesFoundAsync(factory.ClientFor(grace), word);

        Assert.Equal(new[] { byTitle.Id, byText.Id, shared.Id }.Order(), found.Select(f => f.Id).Order());
        var text = found.Single(f => f.Id == byText.Id);
        Assert.Equal($"/notes/{byText.Id}", text.Route);
        Assert.Contains("Marcus Lee", text.Snippet);
        Assert.Contains($"room with {word} labs", text.Snippet);
        Assert.Equal("Shared with you", found.Single(f => f.Id == shared.Id).Badge);
    }

    [Fact]
    public async Task Pages_the_searcher_cannot_open_and_archived_pages_are_never_found()
    {
        var word = Word();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        await factory.AddNoteAsync(hannah, $"{word} private plan");
        var archived = await factory.AddNoteAsync(grace, $"{word} old notes", "Global");
        await factory.ClientFor(grace).PostAsync($"/api/notes/{archived.Id}/archive", null);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Esther Nakamura"), Role.Staff);

        Assert.Empty(await NotesFoundAsync(factory.ClientFor(grace), word));
        Assert.Empty(await NotesFoundAsync(staff, word));
    }

    [Fact]
    public async Task A_page_is_never_found_by_the_title_of_a_page_it_links_to()
    {
        var word = Word();
        var hannah = await factory.AddMemberAsync("Hannah Kim");
        var target = await factory.AddNoteAsync(hannah, $"{word} secret", "Global");
        var linking = await factory.AddNoteAsync(hannah, "Index", "Global");
        (await factory.ClientFor(hannah).SaveNoteAsync(linking, [Block("paragraph", [PageLink(target.Id)])])).EnsureSuccessStatusCode();

        var found = await NotesFoundAsync(factory.ClientFor(await factory.AddMemberAsync("Marcus Lee")), word);

        Assert.Equal([target.Id], found.Select(f => f.Id));
    }
}
