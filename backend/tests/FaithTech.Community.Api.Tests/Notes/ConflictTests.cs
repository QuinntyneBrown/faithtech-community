// Traces to: L2-094
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Notes.NoteClients;

namespace FaithTech.Community.Api.Tests.Notes;

public class ConflictTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task A_save_based_on_an_old_version_is_refused_with_who_saved_the_newer_one()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(grace);
        var page = await client.CreateNoteAsync("Run sheet");
        (await client.SaveNoteAsync(page, [Paragraph("From the laptop")])).EnsureSuccessStatusCode();

        var stale = await client.SaveNoteAsync(page, [Paragraph("From the phone")]);

        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var body = await stale.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(page.Version + 1, body.GetProperty("currentVersion").GetInt32());
        Assert.Equal("Grace Okonkwo", body.GetProperty("updatedByName").GetString());
        Assert.True(body.GetProperty("updatedByYou").GetBoolean());
        Assert.True(body.TryGetProperty("updatedAt", out _));
        var read = (await client.GetFromJsonAsync<Detail>($"/api/notes/{page.Id}"))!;
        Assert.Equal("From the laptop", TextOf(read.Blocks[0]!));
    }

    [Fact]
    public async Task A_System_Admins_newer_save_is_named_and_never_overwritten()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var page = await factory.ClientFor(grace).CreateNoteAsync("Run sheet");
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);
        (await admin.SaveNoteAsync(page, [Paragraph("Fixed a typo")])).EnsureSuccessStatusCode();

        var stale = await factory.ClientFor(grace).SaveNoteAsync(page, [Paragraph("Mine")]);

        var body = await stale.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal((HttpStatusCode.Conflict, "Priya Shah", false),
            (stale.StatusCode, body.GetProperty("updatedByName").GetString(), body.GetProperty("updatedByYou").GetBoolean()));
    }

    [Fact]
    public async Task Saving_with_the_version_the_last_save_returned_succeeds()
    {
        var client = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"));
        var page = await client.CreateNoteAsync("Run sheet");
        var first = (await (await client.SaveNoteAsync(page, [Paragraph("One")])).Content.ReadFromJsonAsync<Saved>())!;

        var second = await client.SaveNoteAsync(page, [Paragraph("Two")], version: first.Version);

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
    }
}
