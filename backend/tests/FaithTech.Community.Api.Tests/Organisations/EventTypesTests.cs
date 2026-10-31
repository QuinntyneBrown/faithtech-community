// Traces to: L2-145 AC1, AC2, AC3, AC4; L2-152 AC1
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Stages & types: the organisation's event types, and the event form, list and pages that follow them.
public class EventTypesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record EventTypeView(Guid Id, string Key, string Name, int SortOrder, bool Archived, DateTime? ArchivedAtUtc, int EventCount);

    public sealed record TypeOption(Guid Id, string Key, string Name);

    public sealed record OrganisationView(TypeOption[] EventTypes);

    public sealed record EventView(Guid Id, string Title, string Type, string TypeName);

    public sealed record EventList(EventView[] Events);

    private const string Types = "/api/organisation/event-types";

    private static readonly DateTimeOffset Start = DateTimeOffset.UtcNow.AddDays(30);

    /// <summary>A new organisation with FaithTech's five types and an administrator who also manages events there.</summary>
    private async Task<(HttpClient Client, OrganisationScopes.OtherOrganisation Organisation)> FreshOrganisationAsync()
    {
        var organisation = await factory.AddOrganisationAsync($"et-{Guid.NewGuid():N}"[..10]);
        var member = await factory.AddMemberAsync(organisation, "Grace Okonkwo", Role.SystemAdmin, Role.EventLead);
        return (factory.ClientOn(organisation, member), organisation);
    }

    private static async Task<EventTypeView[]> ListAsync(HttpClient client, bool archived = false) =>
        (await client.GetFromJsonAsync<EventTypeView[]>($"{Types}{(archived ? "?archived=true" : "")}"))!;

    private static async Task<EventTypeView> TypeAsync(HttpClient client, string key) => (await ListAsync(client)).Single(t => t.Key == key);

    private static object EventBody(string title, string type) => new
    {
        title,
        description = "An evening for Christians who build.",
        type,
        startsAt = Start,
        endsAt = Start.AddHours(2),
        format = "InPerson",
        venue = "Kestrel Labs",
        visibility = "MembersOnly",
    };

    private static async Task<Guid> AddEventAsync(HttpClient client, string title, string type)
    {
        var response = await client.PostAsJsonAsync("/api/events", EventBody(title, type));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<EventView>())!.Id;
    }

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

    // L2-145 AC1: the types in order with their event counts.
    [Fact]
    public async Task The_types_are_listed_in_order_with_event_counts()
    {
        var (client, _) = await FreshOrganisationAsync();
        await AddEventAsync(client, "Spring hackathon", "hackathon");
        await AddEventAsync(client, "Autumn hackathon", "hackathon");
        await AddEventAsync(client, "Panel on AI", "panel");

        var types = await ListAsync(client);

        Assert.Equal(
            [("gathering", "Gathering", 0), ("builders-night", "Builders night", 0), ("hackathon", "Hackathon", 2),
                ("prayer-and-planning", "Prayer & planning", 0), ("panel", "Panel", 1)],
            types.Select(t => (t.Key, t.Name, t.EventCount)));
    }

    [Fact]
    public async Task Members_without_the_settings_capability_cannot_change_the_types()
    {
        var volunteer = factory.ClientFor(await factory.AddMemberAsync("Esther Nakamura"), Role.Volunteer);
        var reader = factory.ClientWithCapabilities(await factory.AddMemberAsync("Marcus Lee"), Capability.ManageRoles);

        Assert.Equal(HttpStatusCode.Forbidden, (await volunteer.GetAsync(Types)).StatusCode);
        var panel = (await ListAsync(reader)).Single(t => t.Key == "panel");
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PostAsJsonAsync(Types, new { Name = "Retreat" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PutAsJsonAsync($"{Types}/{panel.Id}", new { Name = "Talk" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PutAsJsonAsync($"{Types}/order", new { Ids = Array.Empty<Guid>() })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await reader.PostAsync($"{Types}/{panel.Id}/archive", null)).StatusCode);
    }

    // L2-145 AC1, AC2; L2-152 AC1: a new type is keyed from its name, goes at the end, is offered and is audited.
    [Fact]
    public async Task An_added_type_is_offered_at_the_end_and_is_audited()
    {
        var (client, organisation) = await FreshOrganisationAsync();

        var response = await client.PostAsJsonAsync(Types, new { Name = " Prayer walk " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var added = (await response.Content.ReadFromJsonAsync<EventTypeView>())!;
        Assert.Equal(("prayer-walk", "Prayer walk", 6, 0), (added.Key, added.Name, added.SortOrder, added.EventCount));
        var view = (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!;
        Assert.Equal("prayer-walk", view.EventTypes[^1].Key);
        await AddEventAsync(client, "Downtown prayer walk", "prayer-walk");
        var entry = await factory.WithDbAsync(organisation.Id, db => db.AuditEntries.OrderBy(a => a.Id).LastAsync(a => a.Action == "taxonomy.updated"));
        Assert.Contains("Prayer walk", entry.AfterJson);
        Assert.Contains("event-types", entry.AfterJson);
    }

    // L2-145 AC1: a name is required, at most 40 characters and unique among active types ignoring case.
    [Fact]
    public async Task A_type_name_is_required_short_and_unique_ignoring_case()
    {
        var (client, _) = await FreshOrganisationAsync();
        var panel = await TypeAsync(client, "panel");

        Assert.Equal("Enter a name.", await FieldErrorAsync(await client.PostAsJsonAsync(Types, new { Name = "  " }), "Name"));
        Assert.Equal("Use 40 characters or fewer.", await FieldErrorAsync(await client.PostAsJsonAsync(Types, new { Name = new string('a', 41) }), "Name"));
        Assert.Equal("There’s already a type called hackathon.", await FieldErrorAsync(await client.PostAsJsonAsync(Types, new { Name = "hackathon" }), "Name"));
        Assert.Equal(
            "There’s already a type called Gathering.",
            await FieldErrorAsync(await client.PutAsJsonAsync($"{Types}/{panel.Id}", new { Name = "Gathering" }), "Name"));
    }

    // L2-145 AC4: a renamed type shows its new name on its events; the key stays.
    [Fact]
    public async Task A_renamed_type_shows_its_new_name_on_its_events()
    {
        var (client, _) = await FreshOrganisationAsync();
        var id = await AddEventAsync(client, "Panel on AI", "panel");
        var panel = await TypeAsync(client, "panel");

        var response = await client.PutAsJsonAsync($"{Types}/{panel.Id}", new { Name = "Panel discussion" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var shown = (await client.GetFromJsonAsync<EventView>($"/api/events/{id}"))!;
        Assert.Equal(("panel", "Panel discussion"), (shown.Type, shown.TypeName));
    }

    // L2-145 AC2, AC4: an archived type keeps its events and its name on them, leaves the form and the filter, and an
    // event of it can still be edited.
    [Fact]
    public async Task An_archived_type_keeps_its_events_but_leaves_the_form_and_the_filter()
    {
        var (client, _) = await FreshOrganisationAsync();
        var id = await AddEventAsync(client, "Panel on AI", "panel");
        var panel = await TypeAsync(client, "panel");

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"{Types}/{panel.Id}/archive", null)).StatusCode);

        var archived = Assert.Single(await ListAsync(client, archived: true));
        Assert.Equal(("panel", true, 1), (archived.Key, archived.Archived, archived.EventCount));
        Assert.DoesNotContain("panel", (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!.EventTypes.Select(t => t.Key));
        Assert.Equal("Panel", (await client.GetFromJsonAsync<EventView>($"/api/events/{id}"))!.TypeName);
        Assert.Equal("Choose a type from the list.", await FieldErrorAsync(await client.PostAsJsonAsync("/api/events", EventBody("Second panel", "panel")), "Type"));
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync($"/api/events/{id}", EventBody("Panel on AI, renamed", "panel"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync($"/api/events/{id}", EventBody("Panel on AI, renamed", "gathering"))).StatusCode);
        Assert.Equal(
            "Choose a type from the list.",
            await FieldErrorAsync(await client.PutAsJsonAsync($"/api/events/{id}", EventBody("Panel on AI, renamed", "panel")), "Type"));
    }

    // L2-145 AC2: at least one active type must exist for an event to be created.
    [Fact]
    public async Task The_last_active_type_cannot_be_archived()
    {
        var (client, _) = await FreshOrganisationAsync();
        var types = await ListAsync(client);
        foreach (var type in types[1..])
        {
            (await client.PostAsync($"{Types}/{type.Id}/archive", null)).EnsureSuccessStatusCode();
        }

        Assert.Equal(
            "Keep at least one type. Add another type first.",
            await ConflictAsync(await client.PostAsync($"{Types}/{types[0].Id}/archive", null)));
    }

    // L2-145 AC1, AC3: reorder lists every active type once, and the form and filter follow.
    [Fact]
    public async Task Reordering_the_types_reorders_what_the_organisation_offers()
    {
        var (client, _) = await FreshOrganisationAsync();
        var ids = (await ListAsync(client)).Select(t => t.Id).ToArray();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Types}/order", new { Ids = ids[..2] })).StatusCode);
        (await client.PutAsJsonAsync($"{Types}/order", new { Ids = new[] { ids[4], ids[0], ids[1], ids[2], ids[3] } })).EnsureSuccessStatusCode();

        var view = (await client.GetFromJsonAsync<OrganisationView>("/api/organisation"))!;
        Assert.Equal(["panel", "gathering", "builders-night", "hackathon", "prayer-and-planning"], view.EventTypes.Select(t => t.Key));
    }

    // L2-145 AC3: the list filters by a type key of the organisation's.
    [Fact]
    public async Task The_event_list_filters_by_type_key()
    {
        var (client, _) = await FreshOrganisationAsync();
        await AddEventAsync(client, "Spring hackathon", "hackathon");
        await AddEventAsync(client, "Panel on AI", "panel");

        var list = (await client.GetFromJsonAsync<EventList>("/api/events?type=hackathon"))!;

        Assert.Equal([("Spring hackathon", "hackathon", "Hackathon")], list.Events.Select(e => (e.Title, e.Type, e.TypeName)));
    }

    // ADR 0032: another organisation's type is not found, and its key is not one of ours.
    [Fact]
    public async Task Another_organisations_type_is_not_found()
    {
        var (client, _) = await FreshOrganisationAsync();
        var (otherClient, _) = await FreshOrganisationAsync();
        (await otherClient.PostAsJsonAsync(Types, new { Name = "Their retreat" })).EnsureSuccessStatusCode();
        var theirs = await TypeAsync(otherClient, "their-retreat");

        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"{Types}/{theirs.Id}", new { Name = "Ours" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"{Types}/{theirs.Id}/archive", null)).StatusCode);
        Assert.Equal("Choose a type from the list.", await FieldErrorAsync(await client.PostAsJsonAsync("/api/events", EventBody("Retreat", "their-retreat")), "Type"));
    }
}
