// Traces to: L2-059, L2-062, L2-064, L2-066
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Resources;

public class EditResourceTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_owner_edits_the_details_and_the_change_is_recorded()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var client = factory.ClientFor(grace, Role.CityLead);
        factory.Time.Advance(TimeSpan.FromHours(2));

        var response = await client.PutAsJsonAsync($"/api/resources/{deck.Id}",
            EditBody(deck, title: "City launch deck", description: "Use this first.", type: "Template", tags: ["Launch", "launch"], visibility: "Private"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var edited = (await response.Content.ReadFromJsonAsync<Detail>())!;
        Assert.Equal(("City launch deck", "Use this first.", "Template", "Private"), (edited.Title, edited.Description, edited.Type, edited.Visibility));
        Assert.Equal(["launch"], edited.Tags);
        Assert.Equal((factory.Time.GetUtcNow(), "Grace Okonkwo"), (edited.UpdatedAt!.Value, edited.UpdatedByName));
        Assert.Null(edited.FileReplacedAt);
    }

    public static TheoryData<string, object> Invalid() => new()
    {
        { "Title", new { Title = "   ", Type = "Deck", Visibility = "Global" } },
        { "Title", new { Title = new string('a', 121), Type = "Deck", Visibility = "Global" } },
        { "Description", new { Title = "Deck", Description = new string('a', 1001), Type = "Deck", Visibility = "Global" } },
        { "Type", new { Title = "Deck", Type = "Spreadsheet", Visibility = "Global" } },
        { "Visibility", new { Title = "Deck", Type = "Deck", Visibility = "City" } },
        { "Visibility", new { Title = "Deck", Type = "Deck", Visibility = "Shared" } },
    };

    [Theory]
    [MemberData(nameof(Invalid))]
    public async Task Invalid_details_are_refused(string field, object body)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());

        var response = await factory.ClientFor(grace, Role.CityLead).PutAsJsonAsync($"/api/resources/{deck.Id}", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(field, (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors.Keys);
    }

    [Fact]
    public async Task An_empty_title_names_what_to_do()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());

        var response = await factory.ClientFor(grace, Role.CityLead).PutAsJsonAsync($"/api/resources/{deck.Id}", EditBody(deck, title: " "));

        Assert.Equal("Give it a title so people can find it.", (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors["Title"].Single());
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    public async Task Anyone_but_the_owner_or_a_system_admin_is_refused(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var other = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), role);

        var edit = await other.PutAsJsonAsync($"/api/resources/{deck.Id}", EditBody(deck, title: "Mine now"));
        var replace = await other.PutAsync($"/api/resources/{deck.Id}/file", Form([Deck("other.pptx")]));

        Assert.Equal((HttpStatusCode.Forbidden, HttpStatusCode.Forbidden), (edit.StatusCode, replace.StatusCode));
        Assert.False((await other.GetFromJsonAsync<Detail>($"/api/resources/{deck.Id}"))!.CanEdit);
    }

    [Fact]
    public async Task Staff_edit_their_own_resources()
    {
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var deck = await factory.AddFileAsync(esther, Deck(), role: Role.Staff);

        var response = await factory.ClientFor(esther, Role.Staff).PutAsJsonAsync($"/api/resources/{deck.Id}", EditBody(deck, title: "Staff deck"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task A_system_admin_edits_anyones_resource_and_it_is_audited_with_before_and_after()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var priya = await factory.AddMemberAsync("Priya Shah");

        var response = await factory.ClientFor(priya, Role.SystemAdmin).PutAsJsonAsync($"/api/resources/{deck.Id}", EditBody(deck, title: "Launch deck (fixed)"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(e => e.ActorId == priya.ProfileId && e.Action == "resource.edited"));
        Assert.Contains("city-launch-deck", entry.BeforeJson);
        Assert.Contains("Launch deck (fixed)", entry.AfterJson);
    }

    [Fact]
    public async Task Replacing_the_file_keeps_the_id_swaps_the_blob_and_records_the_replacement()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck("launch-v1.pptx"));
        var oldBlobs = factory.Files.Blobs.Keys.Where(k => k.Contains(deck.Id.ToString())).ToList();
        var client = factory.ClientFor(grace, Role.CityLead);

        var response = await client.PutAsync($"/api/resources/{deck.Id}/file", Form([new Upload("launch-v2.pdf", Pdf)]));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var replaced = (await response.Content.ReadFromJsonAsync<Detail>())!;
        Assert.Equal((deck.Id, "launch-v2.pdf", "pdf", "launch-v1"), (replaced.Id, replaced.FileName, replaced.Extension, replaced.Title));
        Assert.Equal(("Grace Okonkwo", factory.Time.GetUtcNow()), (replaced.FileReplacedByName, replaced.FileReplacedAt!.Value));
        Assert.All(oldBlobs, k => Assert.False(factory.Files.Blobs.ContainsKey(k)));
        Assert.Equal(Pdf, await (await client.GetAsync($"/api/resources/{deck.Id}/file")).Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task A_replacement_file_follows_the_upload_rules()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());

        var response = await factory.ClientFor(grace, Role.CityLead).PutAsync($"/api/resources/{deck.Id}/file", Form([new Upload("virus.exe", [0x4D, 0x5A])]));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("city-launch-deck.pptx", (await factory.WithDbAsync(db => db.Resources.SingleAsync(r => r.Id == deck.Id))).File!.FileName);
    }

    [Fact]
    public async Task An_owner_who_loses_their_contributing_role_keeps_their_resources()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        await factory.WithDbAsync(async db =>
        {
            var profile = await db.Profiles.SingleAsync(p => p.Id == grace.ProfileId);
            profile.RemoveRole(Role.CityLead);
            return await db.SaveChangesAsync();
        });
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);

        var page = (await admin.GetFromJsonAsync<Detail>($"/api/resources/{deck.Id}"))!;

        Assert.Equal((grace.ProfileId, "Global", "CityLead"), (page.OwnerId, page.Visibility, page.OwnerLostRole));
    }
}
