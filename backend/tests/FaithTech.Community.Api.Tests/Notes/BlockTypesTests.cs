// Traces to: L2-087
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class BlockTypesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Every_block_type_is_saved_and_read_back_with_its_fields()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Toronto city team playbook");
        const string code = "Hi {name},\n\tDoors 6:00 pm  ·  Talks 6:30 pm";
        object[] blocks =
        [
            Block("heading1", [new { Text = "Our rhythm" }]),
            Block("heading2", [new { Text = "Every month" }]),
            Block("heading3", [new { Text = "The week before" }]),
            Block("bulleted", [new { Text = "Builders Night" }]),
            Block("numbered", [new { Text = "Confirm the room" }]),
            Block("todo", [new { Text = "Order food for 40" }], @checked: true),
            Block("quote", [new { Text = "Work at it with all your heart." }]),
            Block("callout", [new { Text = "New to the team?" }], icon: "🧭"),
            Block("code", [new { Text = code }]),
            Block("divider"),
            Block("link", url: "https://docs.google.com/spreadsheets/d/1", caption: "Volunteer rota"),
        ];

        (await client.SaveNoteAsync(page, blocks)).EnsureSuccessStatusCode();

        var read = (await client.GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;
        Assert.Equal(
            ["heading1", "heading2", "heading3", "bulleted", "numbered", "todo", "quote", "callout", "code", "divider", "link"],
            read.Blocks.Select(b => b!["type"]!.GetValue<string>()));
        Assert.True(read.Blocks[5]!["checked"]!.GetValue<bool>());
        Assert.Equal("🧭", read.Blocks[7]!["icon"]!.GetValue<string>());
        Assert.Equal(code, TextOf(read.Blocks[8]!));
        Assert.Equal(("https://docs.google.com/spreadsheets/d/1", "Volunteer rota"),
            (read.Blocks[10]!["url"]!.GetValue<string>(), read.Blocks[10]!["caption"]!.GetValue<string>()));
    }

    [Theory]
    [InlineData("http://docs.google.com")]
    [InlineData("javascript:alert(1)")]
    [InlineData("not a link")]
    [InlineData("")]
    public async Task A_link_card_must_be_an_https_link(string url)
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Links");

        var response = await client.SaveNoteAsync(page, [Block("link", url: url)]);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("caption")]
    [InlineData("long-link")]
    [InlineData("icon")]
    public async Task Fields_over_their_limits_are_refused(string field)
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Limits");
        object block = field switch
        {
            "caption" => Block("link", url: "https://faithtech.community", caption: new string('c', 201)),
            "long-link" => Block("link", url: "https://faithtech.community/" + new string('a', 2000)),
            _ => Block("callout", [new { Text = "Note" }], icon: "not an emoji"),
        };

        var response = await client.SaveNoteAsync(page, [block]);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_page_icon_must_be_a_single_emoji()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Icons");

        Assert.Equal(HttpStatusCode.OK, (await client.SaveNoteAsync(page, [], icon: "🛠️")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.SaveNoteAsync(page, [], icon: "abc", version: page.Version + 1)).StatusCode);
    }
}
