// Traces to: L2-088 AC2, AC3
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class FormattingTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Marks_and_hyperlinks_are_saved_on_the_spans()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Playbook");
        object[] spans =
        [
            new { Text = "Start " },
            new { Text = "here", Bold = true, Italic = true },
            new { Text = " · " },
            new { Text = "FT-TOR", Code = true, Underline = true, Strike = true },
            new { Text = " · " },
            new { Text = "our site", Href = "https://faithtech.community" },
            new { Text = " · " },
            new { Text = "email us", Href = "mailto:toronto@faithtech.com" },
        ];

        (await client.SaveNoteAsync(page, [Block("paragraph", spans)])).EnsureSuccessStatusCode();

        var text = (await client.GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!.Blocks[0]!["text"]!.AsArray();
        Assert.True(text[1]!["bold"]!.GetValue<bool>() && text[1]!["italic"]!.GetValue<bool>());
        Assert.True(text[3]!["code"]!.GetValue<bool>() && text[3]!["underline"]!.GetValue<bool>() && text[3]!["strike"]!.GetValue<bool>());
        Assert.Equal("https://faithtech.community", text[5]!["href"]!.GetValue<string>());
        Assert.Equal("mailto:toronto@faithtech.com", text[7]!["href"]!.GetValue<string>());
    }

    [Theory]
    [InlineData("http://faithtech.community")]
    [InlineData("javascript:alert(1)")]
    [InlineData("ftp://files.example.org")]
    [InlineData("/notes/relative")]
    public async Task A_hyperlink_must_be_https_or_mailto(string href)
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Playbook");

        var response = await client.SaveNoteAsync(page, [Block("paragraph", [new { Text = "link", Href = href }])]);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
