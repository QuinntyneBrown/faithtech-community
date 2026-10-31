// Traces to: L2-146 AC1, AC2, AC3, AC4; L2-151 AC4; L2-152 AC1
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Resources.ResourceClients;

namespace FaithTech.Community.Api.Tests.Organisations;

// Stages & types: the organisation's resource types, and the upload guess, dialogs and filter that follow them.
public class ResourceTypesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record ResourceTypeView(
        Guid Id, string Key, string Name, int SortOrder, bool Archived, DateTime? ArchivedAtUtc, int ResourceCount, bool CanArchive);

    public sealed record TypeOption(Guid Id, string Key, string Name);

    public sealed record OrganisationView(TypeOption[] ResourceTypes);

    private const string Types = "/api/organisation/resource-types";

    /// <summary>A new organisation with FaithTech's seven types and an administrator who also adds resources there.</summary>
    private async Task<(HttpClient Client, OrganisationScopes.OtherOrganisation Organisation)> FreshOrganisationAsync()
    {
        var organisation = await factory.AddOrganisationAsync($"rt-{Guid.NewGuid():N}"[..10]);
        var member = await factory.AddMemberAsync(organisation, "Grace Okonkwo", Role.SystemAdmin, Role.CityLead);
        return (factory.ClientOn(organisation, member), organisation);
    }

    private static async Task<ResourceTypeView[]> ListAsync(HttpClient client, bool archived = false) =>
        (await client.GetFromJsonAsync<ResourceTypeView[]>($"{Types}{(archived ? "?archived=true" : "")}"))!;

    private static async Task<ResourceTypeView> TypeAsync(HttpClient client, string key) => (await ListAsync(client)).Single(t => t.Key == key);

    private static object LinkBody(string title, string type) => new
    {
        Url = "https://www.canva.com/design/DAF123/edit",
        Title = title,
        Description = "Canva",
        Type = type,
        Tags = Array.Empty<string>(),
        Visibility = "Global",
    };

    private static async Task<Detail> AddLinkAsync(HttpClient client, string title, string type)
    {
        var response = await client.PostAsJsonAsync("/api/resources/links", LinkBody(title, type));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<Detail>())!;
    }

    private static async Task<Detail> UploadAsync(HttpClient client, string fileName)
    {
        var response = await client.UploadAsync(Deck(fileName));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return Assert.Single((await response.Content.ReadFromJsonAsync<Detail[]>())!);
    }

    private static async Task<Detail> ResourceAsync(HttpClient client, Guid id) =>
        (await client.GetFromJsonAsync<Detail>($"/api/resources/{id}"))!;

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return Assert.Single((await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
    }

    private static async Task<string?> ConflictAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail;
    }

    // L2-146 AC1: the types in order with their resource counts; other cannot be archived.
    [Fact]
    public async Task The_types_are_listed_in_order_with_resource_counts()
    {
        var (client, _) = await FreshOrganisationAsync();
        await AddLinkAsync(client, "Poster", "template");
        await AddLinkAsync(client, "Flyer", "template");
        await UploadAsync(client, "pitch.pptx");

        var types = await ListAsync(client);

        Assert.Equal(
            [("deck", "Deck", 1), ("logo", "Logo", 0), ("image", "Image", 0), ("training", "Training", 0), ("template", "Template", 2),
                ("document", "Document", 0), ("other", "Other", 0)],
            types.Select(t => (t.Key, t.Name, t.ResourceCount)));
        Assert.Equal(["other"], types.Where(t => !t.CanArchive).Select(t => t.Key));
    }

    [Fact]
    public async Task Members_without_the_settings_capability_cannot_change_the_types()
    {
        var volunteer = factory.ClientFor(await factory.AddMemberAsync("Esther Nakamura"), Role.Volunteer);
        var reader = factory.ClientWithCapabilities(await factory.AddMemberAsync("Marcus Lee"), Capability.ManageRoles);

        Assert.Equal(HttpStatusCode.Forbidden, (await volunteer.GetAsync(Types)).StatusCode);
        var deck = (await ListAsync(reader)).Single(t => t.Key == "deck");
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PostAsJsonAsync(Types, new { Name = "Poster" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PutAsJsonAsync($"{Types}/{deck.Id}", new { Name = "Slides" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PutAsJsonAsync($"{Types}/order", new { Ids = Array.Empty<Guid>() })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PostAsync($"{Types}/{deck.Id}/archive", null)).StatusCode);
    }

    // L2-146 AC1, AC2; L2-152 AC1: a new type is keyed from its name, goes at the end, is offered and is audited.
    [Fact]
    public async Task An_added_type_is_offered_at_the_end_and_is_audited()
    {
        var (client, organisation) = await FreshOrganisationAsync();

        var response = await client.PostAsJsonAsync(Types, new { Name = " Event poster " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var added = (await response.Content.ReadFromJsonAsync<ResourceTypeView>())!;
        Assert.Equal(("event-poster", "Event poster", 8, 0), (added.Key, added.Name, added.SortOrder, added.ResourceCount));
        var view = (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!;
        Assert.Equal("event-poster", view.ResourceTypes[^1].Key);
        var link = await AddLinkAsync(client, "Spring poster", "event-poster");
        Assert.Equal(("event-poster", "Event poster"), (link.Type, link.TypeName));
        var entry = await factory.WithDbAsync(organisation.Id, db => db.AuditEntries.OrderBy(a => a.Id).LastAsync(a => a.Action == "taxonomy.updated"));
        Assert.Contains("Event poster", entry.AfterJson);
        Assert.Contains("resource-types", entry.AfterJson);
    }

    // L2-146 AC1: a name is required, at most 40 characters and unique among active types ignoring case.
    [Fact]
    public async Task A_type_name_is_required_short_and_unique_ignoring_case()
    {
        var (client, _) = await FreshOrganisationAsync();
        var deck = await TypeAsync(client, "deck");

        Assert.Equal("Enter a name.", await FieldErrorAsync(await client.PostAsJsonAsync(Types, new { Name = "  " }), "Name"));
        Assert.Equal("Use 40 characters or fewer.", await FieldErrorAsync(await client.PostAsJsonAsync(Types, new { Name = new string('a', 41) }), "Name"));
        Assert.Equal("There’s already a type called logo.", await FieldErrorAsync(await client.PostAsJsonAsync(Types, new { Name = "logo" }), "Name"));
        Assert.Equal(
            "There’s already a type called Image.",
            await FieldErrorAsync(await client.PutAsJsonAsync($"{Types}/{deck.Id}", new { Name = "Image" }), "Name"));
    }

    // L2-146 AC1: the type keyed other is the fallback for a guessed type, so it is never archived.
    [Fact]
    public async Task The_type_keyed_other_cannot_be_archived()
    {
        var (client, _) = await FreshOrganisationAsync();
        var other = await TypeAsync(client, "other");

        Assert.Equal(
            "Other is where uploads go when their type can’t be guessed, so it can’t be archived.",
            await ConflictAsync(await client.PostAsync($"{Types}/{other.Id}/archive", null)));
    }

    // L2-146 AC2, AC4: an archived type keeps its resources and their name, leaves the dialogs, and a resource of it can
    // still be edited with it; the list can still filter by it.
    [Fact]
    public async Task An_archived_type_keeps_its_resources_but_leaves_the_dialogs()
    {
        var (client, _) = await FreshOrganisationAsync();
        var poster = await AddLinkAsync(client, "Poster", "template");
        var template = await TypeAsync(client, "template");

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"{Types}/{template.Id}/archive", null)).StatusCode);

        var archived = Assert.Single(await ListAsync(client, archived: true));
        Assert.Equal(("template", true, 1), (archived.Key, archived.Archived, archived.ResourceCount));
        Assert.DoesNotContain("template", (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!.ResourceTypes.Select(t => t.Key));
        Assert.Equal("Template", (await ResourceAsync(client, poster.Id)).TypeName);
        Assert.Equal(["Poster"], (await client.ListResourcesAsync("?type=template")).Items.Select(i => i.Title));
        Assert.Equal("Choose a type.", await FieldErrorAsync(await client.PostAsJsonAsync("/api/resources/links", LinkBody("Flyer", "template")), "Type"));

        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/resources/{poster.Id}", EditBody(poster, title: "Spring poster"))).StatusCode);
        var kept = await ResourceAsync(client, poster.Id);
        Assert.Equal(("Spring poster", "template"), (kept.Title, kept.Type));
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/resources/{poster.Id}", EditBody(kept, type: "image"))).StatusCode);
        var moved = await ResourceAsync(client, poster.Id);
        Assert.Equal("Choose a type.", await FieldErrorAsync(await client.PutAsJsonAsync($"/api/resources/{poster.Id}", EditBody(moved, type: "template")), "Type"));
    }

    // L2-146 AC3: the guess maps by key to the organisation's active type, else to other.
    [Fact]
    public async Task The_guess_maps_by_key_and_falls_back_to_other()
    {
        var (client, _) = await FreshOrganisationAsync();
        var deck = await TypeAsync(client, "deck");
        (await client.PutAsJsonAsync($"{Types}/{deck.Id}", new { Name = "Slides" })).EnsureSuccessStatusCode();

        var renamed = await UploadAsync(client, "pitch.pptx");
        (await client.PostAsync($"{Types}/{deck.Id}/archive", null)).EnsureSuccessStatusCode();
        var fallback = await UploadAsync(client, "launch.pptx");

        Assert.Equal(("deck", "Slides"), (renamed.Type, renamed.TypeName));
        Assert.Equal(("other", "Other"), (fallback.Type, fallback.TypeName));
    }

    // L2-146 AC1: reorder lists every active type once, and the dialogs and filter follow.
    [Fact]
    public async Task Reordering_the_types_reorders_what_the_organisation_offers()
    {
        var (client, _) = await FreshOrganisationAsync();
        var ids = (await ListAsync(client)).Select(t => t.Id).ToArray();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Types}/order", new { Ids = ids[..2] })).StatusCode);
        (await client.PutAsJsonAsync($"{Types}/order", new { Ids = new[] { ids[6], ids[0], ids[1], ids[2], ids[3], ids[4], ids[5] } })).EnsureSuccessStatusCode();

        var view = (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!;
        Assert.Equal(["other", "deck", "logo", "image", "training", "template", "document"], view.ResourceTypes.Select(t => t.Key));
    }

    // ADR 0032: another organisation's type is not found, and its key is not one of ours.
    [Fact]
    public async Task Another_organisations_type_is_not_found()
    {
        var (client, _) = await FreshOrganisationAsync();
        var (otherClient, _) = await FreshOrganisationAsync();
        (await otherClient.PostAsJsonAsync(Types, new { Name = "Their poster" })).EnsureSuccessStatusCode();
        var theirs = await TypeAsync(otherClient, "their-poster");

        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"{Types}/{theirs.Id}", new { Name = "Ours" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"{Types}/{theirs.Id}/archive", null)).StatusCode);
        Assert.Equal("Choose a type.", await FieldErrorAsync(await client.PostAsJsonAsync("/api/resources/links", LinkBody("Poster", "their-poster")), "Type"));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/resources?type=their-poster")).StatusCode);
    }
}
