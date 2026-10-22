// Traces to: L2-063, L2-064, L2-066
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Resources;

public class ArchiveResourcesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Archived(Guid Id, string Title, string Type, string? Extension, long? Size, string? LinkHost, DateTimeOffset ArchivedAt, DateTimeOffset PurgeAt);

    [Fact]
    public async Task An_archived_resource_disappears_for_everyone_but_its_owner_who_sees_it_in_archived()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var owner = factory.ClientFor(grace, Role.CityLead);
        var member = factory.ClientFor(await factory.AddMemberAsync("Samuel Mensah"));

        var response = await owner.PostAsync($"/api/resources/{deck.Id}/archive", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync($"/api/resources/{deck.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync($"/api/resources/{deck.Id}/file")).StatusCode);
        Assert.DoesNotContain((await member.ListResourcesAsync()).Items, r => r.Id == deck.Id);
        Assert.DoesNotContain((await owner.ListResourcesAsync()).Items, r => r.Id == deck.Id);
        var page = (await owner.GetFromJsonAsync<Detail>($"/api/resources/{deck.Id}"))!;
        var now = factory.Time.GetUtcNow();
        Assert.Equal((now, now.AddDays(30)), (page.ArchivedAt!.Value, page.PurgeAt!.Value));
        var archived = Assert.Single((await owner.GetFromJsonAsync<Archived[]>("/api/resources/archived"))!);
        Assert.Equal((deck.Id, "pptx", now.AddDays(30)), (archived.Id, archived.Extension, archived.PurgeAt));
        Assert.Empty((await member.GetFromJsonAsync<Archived[]>("/api/resources/archived"))!);
    }

    [Fact]
    public async Task Restoring_brings_it_back_with_the_same_visibility_tags_and_file()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var daniel = await factory.AddMemberAsync("Daniel Reyes");
        var pitch = await factory.AddFileAsync(grace, Deck(), new Dictionary<string, string> { ["visibility"] = "Shared", ["memberIds"] = daniel.ProfileId.ToString() }, ["partners"]);
        var owner = factory.ClientFor(grace, Role.CityLead);
        await owner.PostAsync($"/api/resources/{pitch.Id}/archive", null);

        var response = await owner.PostAsync($"/api/resources/{pitch.Id}/restore", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var page = (await factory.ClientFor(daniel).GetFromJsonAsync<Detail>($"/api/resources/{pitch.Id}"))!;
        Assert.Equal(("Shared", "partners", "city-launch-deck.pptx", null), (page.Visibility, page.Tags.Single(), page.FileName, page.ArchivedAt));
    }

    [Fact]
    public async Task Archiving_twice_or_editing_an_archived_resource_is_a_conflict()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var owner = factory.ClientFor(grace, Role.CityLead);
        await owner.PostAsync($"/api/resources/{deck.Id}/archive", null);

        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsync($"/api/resources/{deck.Id}/archive", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync($"/api/resources/{deck.Id}", EditBody(deck, title: "x"))).StatusCode);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    public async Task Members_who_do_not_own_it_cannot_archive_or_restore(Role role)
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var other = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), role);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.PostAsync($"/api/resources/{deck.Id}/archive", null)).StatusCode);
        await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/resources/{deck.Id}/archive", null);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync($"/api/resources/{deck.Id}/restore", null)).StatusCode);
    }

    [Fact]
    public async Task Staff_archive_and_restore_their_own()
    {
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        var deck = await factory.AddFileAsync(esther, Deck(), role: Role.Staff);
        var staff = factory.ClientFor(esther, Role.Staff);

        Assert.Equal(HttpStatusCode.NoContent, (await staff.PostAsync($"/api/resources/{deck.Id}/archive", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await staff.PostAsync($"/api/resources/{deck.Id}/restore", null)).StatusCode);
    }

    [Fact]
    public async Task A_system_admin_archives_and_restores_anyones_resource_and_both_are_audited()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var deck = await factory.AddFileAsync(grace, Deck());
        var priya = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientFor(priya, Role.SystemAdmin);

        await admin.PostAsync($"/api/resources/{deck.Id}/archive", null);
        await admin.PostAsync($"/api/resources/{deck.Id}/restore", null);

        var actions = await factory.WithDbAsync(db => db.AuditEntries.Where(e => e.ActorId == priya.ProfileId).Select(e => e.Action).ToListAsync());
        Assert.Contains("resource.archived", actions);
        Assert.Contains("resource.restored", actions);
    }

    [Fact]
    public async Task The_purge_deletes_resources_archived_30_days_ago_with_their_blobs_and_keeps_the_audit_log()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var old = await factory.AddFileAsync(grace, new Upload("old.jpg", TestImages.Jpeg()));
        var recent = await factory.AddFileAsync(grace, Deck());
        var priya = await factory.AddMemberAsync("Priya Shah");
        await factory.ClientFor(priya, Role.SystemAdmin).PostAsync($"/api/resources/{old.Id}/archive", null);
        factory.Time.Advance(TimeSpan.FromDays(29));
        await factory.ClientFor(grace, Role.CityLead).PostAsync($"/api/resources/{recent.Id}/archive", null);
        var oldBlobs = factory.Files.Blobs.Keys.Where(k => k.Contains(old.Id.ToString())).ToList();

        await factory.PurgeArchivedResourcesAsync();
        Assert.True(await factory.WithDbAsync(db => db.Resources.AnyAsync(r => r.Id == old.Id)));

        factory.Time.Advance(TimeSpan.FromDays(1));
        await factory.PurgeArchivedResourcesAsync();
        await factory.PurgeArchivedResourcesAsync();

        Assert.False(await factory.WithDbAsync(db => db.Resources.AnyAsync(r => r.Id == old.Id)));
        Assert.True(await factory.WithDbAsync(db => db.Resources.AnyAsync(r => r.Id == recent.Id)));
        Assert.Equal(2, oldBlobs.Count);
        Assert.All(oldBlobs, k => Assert.False(factory.Files.Blobs.ContainsKey(k)));
        Assert.True(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(e => e.TargetId == old.Id.ToString())));
    }
}
