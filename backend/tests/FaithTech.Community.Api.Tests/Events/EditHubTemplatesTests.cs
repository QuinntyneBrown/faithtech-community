// Traces to: L2-184 AC3, L2-185 AC1 to AC6, L2-186 AC2 to AC6, L2-187 AC1 to AC4
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

// Organisation administrators edit their hub templates in settings (ADR 0043); new hubs copy the edit, old hubs keep theirs.
public class EditHubTemplatesTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string Templates = "/api/hub-templates";

    private static readonly string[] Core = ["Hero", "Agenda", "Venue", "People", "Links", "Giving", "UpcomingEvents"];

    /// <summary>A new organisation, with no templates, and an administrator there (AdministerOrganisation holds every capability).</summary>
    private async Task<(HttpClient Admin, OrganisationScopes.OtherOrganisation Organisation)> FreshAsync()
    {
        var organisation = await factory.AddOrganisationAsync($"ht-{Guid.NewGuid():N}"[..10]);
        var admin = await factory.AddMemberAsync(organisation, "Priya Shah", Role.SystemAdmin);
        return (factory.ClientOn(organisation, admin), organisation);
    }

    private static async Task<JsonElement> AddAsync(HttpClient client, string name, string? description = null)
    {
        var response = await client.PostAsJsonAsync(Templates, new { name, description });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static string Id(JsonElement template) => template.GetProperty("id").GetString()!;

    private static async Task<JsonElement[]> ListAsync(HttpClient client, bool archived = false) =>
        (await client.GetFromJsonAsync<JsonElement[]>($"{Templates}?archived={archived.ToString().ToLowerInvariant()}"))!;

    private static string[] Shown(JsonElement template) =>
        [.. template.GetProperty("shown").EnumerateArray().Select(k => k.GetString()!)];

    private static JsonElement Section(JsonElement detail, string kind) =>
        detail.GetProperty("sections").EnumerateArray().Single(s => s.GetProperty("kind").GetString() == kind);

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return Assert.Single((await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors[field]);
    }

    private static object EventBody(string title, DateTimeOffset start) => new
    {
        title,
        description = "A day of building for the church.",
        type = "hackathon",
        startsAt = start,
        endsAt = start.AddHours(10),
        format = "InPerson",
        venue = "Kestrel Labs",
        visibility = "MembersOnly",
    };

    /// <summary>An event with a hub started from the template; answers the hub as its home reads it.</summary>
    private static async Task<(Guid EventId, JsonElement Hub)> HubFromAsync(HttpClient client, string templateId, DateTimeOffset start)
    {
        var created = await client.PostAsJsonAsync("/api/events", EventBody("Toronto Hackathon", start));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var eventId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsync($"/api/events/{eventId}/hub", null)).StatusCode);
        var started = await client.PostAsJsonAsync($"/api/events/{eventId}/hub/start", new { templateId });
        Assert.Equal(HttpStatusCode.OK, started.StatusCode);
        return (eventId, await started.Content.ReadFromJsonAsync<JsonElement>());
    }

    // L2-184 AC3, L2-185 AC1: an added template goes last, shows the core sections, has no defaults and is audited.
    [Fact]
    public async Task An_added_template_is_listed_last_with_the_core_sections_and_is_audited()
    {
        var (admin, organisation) = await FreshAsync();
        await AddAsync(admin, "Hackathon", "A day of building in teams.");

        var added = await AddAsync(admin, " Retreat ", " A weekend away to rest, pray and plan. ");

        Assert.Equal(("Retreat", "A weekend away to rest, pray and plan."),
            (added.GetProperty("name").GetString(), added.GetProperty("description").GetString()));
        var list = await ListAsync(admin);
        Assert.Equal(["Hackathon", "Retreat"], list.Select(t => t.GetProperty("name").GetString()));
        Assert.Equal(Core, Shown(list[1]));
        Assert.Equal(0, list[1].GetProperty("hubCount").GetInt32());
        var detail = await admin.GetFromJsonAsync<JsonElement>($"{Templates}/{Id(added)}");
        Assert.Equal(Core, detail.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("kind").GetString()));
        Assert.All(detail.GetProperty("sections").EnumerateArray(), s => Assert.Equal(JsonValueKind.Null, s.GetProperty("content").ValueKind));
        // Audit ids are Guids, so the two adds are told apart by what they record rather than by order.
        var entries = await factory.WithDbAsync(organisation.Id, db => db.AuditEntries.Where(a => a.Action == "hub_template.updated").ToListAsync());
        Assert.Equal(2, entries.Count);
        Assert.Single(entries, e => e.AfterJson != null && e.AfterJson.Contains("Retreat"));
        // The wizard offers it to hub managers too (L2-169 AC2).
        var wizard = (await admin.GetFromJsonAsync<JsonElement[]>("/api/event-hubs/templates"))!;
        Assert.Equal(["Hackathon", "Retreat"], wizard.Select(t => t.GetProperty("name").GetString()));
    }

    // L2-185 AC3: a name is required, at most 60, unique among active templates ignoring case; a description at most 120.
    [Fact]
    public async Task A_template_name_is_required_short_and_unique()
    {
        var (admin, _) = await FreshAsync();
        var meetup = await AddAsync(admin, "Meetup");
        var workshop = await AddAsync(admin, "Workshop");

        Assert.Equal("Enter a name.", await FieldErrorAsync(await admin.PostAsJsonAsync(Templates, new { name = " " }), "name"));
        Assert.Equal("Use 60 characters or fewer.",
            await FieldErrorAsync(await admin.PostAsJsonAsync(Templates, new { name = new string('a', 61) }), "name"));
        Assert.Equal("Use 120 characters or fewer.",
            await FieldErrorAsync(await admin.PostAsJsonAsync(Templates, new { name = "Retreat", description = new string('a', 121) }), "description"));
        Assert.Equal("There’s already a template called meetup.",
            await FieldErrorAsync(await admin.PostAsJsonAsync(Templates, new { name = "meetup" }), "name"));
        Assert.Equal("There’s already a template called Meetup.",
            await FieldErrorAsync(await admin.PutAsJsonAsync($"{Templates}/{Id(workshop)}", new { name = "Meetup" }), "name"));

        var renamed = await admin.PutAsJsonAsync($"{Templates}/{Id(meetup)}", new { name = "Builders night", description = "Talks and conversation." });

        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        Assert.Equal(["Builders night", "Workshop"], (await ListAsync(admin)).Select(t => t.GetProperty("name").GetString()));
    }

    // L2-185 AC4, AC5: archiving leaves the wizard and refuses applying; restoring puts it last; a taken name is 409.
    [Fact]
    public async Task An_archived_template_leaves_the_wizard_and_comes_back_last_when_restored()
    {
        var (admin, _) = await FreshAsync();
        var workshop = await AddAsync(admin, "Workshop");
        await AddAsync(admin, "Meetup");

        var archived = await admin.PostAsync($"{Templates}/{Id(workshop)}/archive", null);

        Assert.Equal(HttpStatusCode.OK, archived.StatusCode);
        Assert.Equal(["Meetup"], (await ListAsync(admin)).Select(t => t.GetProperty("name").GetString()));
        var gone = await ListAsync(admin, archived: true);
        Assert.Equal("Workshop", Assert.Single(gone).GetProperty("name").GetString());
        Assert.NotEqual(JsonValueKind.Null, gone[0].GetProperty("archivedAtUtc").ValueKind);
        Assert.Equal(["Meetup"], (await admin.GetFromJsonAsync<JsonElement[]>("/api/event-hubs/templates"))!.Select(t => t.GetProperty("name").GetString()));
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync($"{Templates}/{Id(workshop)}", new { name = "Lab" })).StatusCode);
        var created = await admin.PostAsJsonAsync("/api/events", EventBody("Workshop night", DateTimeOffset.UtcNow.AddDays(20)));
        var eventId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        await admin.PostAsync($"/api/events/{eventId}/hub", null);
        Assert.Equal("Choose a starting point from the list.",
            await FieldErrorAsync(await admin.PostAsJsonAsync($"/api/events/{eventId}/hub/start", new { templateId = Id(workshop) }), "templateId"));

        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"{Templates}/{Id(workshop)}/restore", null)).StatusCode);
        Assert.Equal(["Meetup", "Workshop"], (await ListAsync(admin)).Select(t => t.GetProperty("name").GetString()));

        await admin.PostAsync($"{Templates}/{Id(workshop)}/archive", null);
        await AddAsync(admin, "workshop");
        var clash = await admin.PostAsync($"{Templates}/{Id(workshop)}/restore", null);
        Assert.Equal(HttpStatusCode.Conflict, clash.StatusCode);
        Assert.Equal("There’s already a template called Workshop. Rename it first.",
            (await clash.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    // L2-186 AC2: ticks set what new hubs show; defaults are kept; an unticked optional kind without a default is dropped.
    [Fact]
    public async Task Choosing_sections_sets_what_the_template_shows()
    {
        var (admin, _) = await FreshAsync();
        var retreat = await AddAsync(admin, "Retreat");
        var hero = await admin.PutAsJsonAsync($"{Templates}/{Id(retreat)}/sections/Hero", new { subtitle = "Rest, pray and plan." });
        Assert.Equal(HttpStatusCode.NoContent, hero.StatusCode);

        var saved = await admin.PutAsJsonAsync($"{Templates}/{Id(retreat)}/sections", new { shown = new[] { "Agenda", "Worship", "WhatToBring" } });

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var detail = await admin.GetFromJsonAsync<JsonElement>($"{Templates}/{Id(retreat)}");
        Assert.Equal(["Hero", "Agenda", "Venue", "WhatToBring", "People", "Links", "Worship", "Giving", "UpcomingEvents"],
            detail.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("kind").GetString()));
        Assert.False(Section(detail, "Hero").GetProperty("visible").GetBoolean());
        Assert.Equal("Rest, pray and plan.", Section(detail, "Hero").GetProperty("content").GetProperty("subtitle").GetString());
        Assert.True(Section(detail, "Worship").GetProperty("visible").GetBoolean());
        Assert.Equal(["Agenda", "WhatToBring", "Worship"], Shown((await ListAsync(admin)).Single()));

        await admin.PutAsJsonAsync($"{Templates}/{Id(retreat)}/sections", new { shown = new[] { "Agenda" } });
        var after = await admin.GetFromJsonAsync<JsonElement>($"{Templates}/{Id(retreat)}");
        Assert.DoesNotContain(after.GetProperty("sections").EnumerateArray(), s => s.GetProperty("kind").GetString() == "Worship");

        Assert.Equal("Tick at least one section.",
            await FieldErrorAsync(await admin.PutAsJsonAsync($"{Templates}/{Id(retreat)}/sections", new { shown = Array.Empty<string>() }), "shown"));
        Assert.Equal("Choose sections from the list.",
            await FieldErrorAsync(await admin.PutAsJsonAsync($"{Templates}/{Id(retreat)}/sections", new { shown = new[] { "Hero", "Raffle" } }), "shown"));
    }

    // L2-186 AC3 to AC5: defaults are validated with the hub's messages; Agenda takes minutes; per-hub kinds take none.
    [Fact]
    public async Task Defaults_are_validated_like_a_hubs_and_the_agenda_is_stored_in_minutes()
    {
        var (admin, _) = await FreshAsync();
        var id = Id(await AddAsync(admin, "Hackathon"));

        Assert.Equal("Use 140 characters or fewer.",
            await FieldErrorAsync(await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Hero", new { subtitle = new string('a', 141) }), "subtitle"));
        Assert.Equal("Say what’s happening.", await FieldErrorAsync(
            await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Agenda", new { items = new[] { new { minutes = 0, title = " ", detail = (string?)null } } }),
            "items[0].title"));
        Assert.Equal("Use a time within a week of the start.", await FieldErrorAsync(
            await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Agenda", new { items = new[] { new { minutes = 10081, title = "Late", detail = (string?)null } } }),
            "items[0].minutes"));
        Assert.Equal("This section is filled in on each hub.",
            await FieldErrorAsync(await admin.PutAsJsonAsync($"{Templates}/{id}/sections/People", new { people = Array.Empty<object>() }), "kind"));
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Raffle", new { })).StatusCode);

        var agenda = await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Agenda", new
        {
            items = new[] { new { minutes = 0, title = " Doors open ", detail = (string?)"Grab a coffee." }, new { minutes = 90, title = "Demos", detail = (string?)null } },
        });
        var process = await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Process", new
        {
            name = "The Create Cycle",
            intro = (string?)null,
            stages = new[] { new { title = "Lament", when = (string?)null, summary = (string?)"We refuse to rush past pain.", points = Array.Empty<object>() } },
        });

        Assert.Equal(HttpStatusCode.NoContent, agenda.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, process.StatusCode);
        var detail = await admin.GetFromJsonAsync<JsonElement>($"{Templates}/{id}");
        var items = Section(detail, "Agenda").GetProperty("content").GetProperty("items").EnumerateArray().ToList();
        Assert.Equal([(0, "Doors open"), (90, "Demos")], items.Select(i => (i.GetProperty("minutes").GetInt32(), i.GetProperty("title").GetString())));
        var processSection = Section(detail, "Process");
        Assert.True(processSection.GetProperty("visible").GetBoolean());
        Assert.Equal("The Create Cycle", processSection.GetProperty("content").GetProperty("name").GetString());
    }

    // L2-187 AC1, AC2: a new hub uses the edited template; a hub started before keeps what it had.
    [Fact]
    public async Task New_hubs_use_the_edited_template_and_earlier_hubs_do_not_change()
    {
        var (admin, _) = await FreshAsync();
        var id = Id(await AddAsync(admin, "Hackathon"));
        await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Hero", new { subtitle = "One day to build for the church." });
        var first = DateTimeOffset.UtcNow.AddDays(10);
        var (earlierId, _) = await HubFromAsync(admin, id, first);

        await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Hero", new { subtitle = "Build something real together." });
        await admin.PutAsJsonAsync($"{Templates}/{id}/sections/Agenda", new { items = new[] { new { minutes = 30, title = "Welcome", detail = (string?)null } } });
        await admin.PutAsJsonAsync($"{Templates}/{id}/sections", new { shown = new[] { "Hero", "Agenda", "Rules" } });
        await admin.PutAsJsonAsync($"{Templates}/{id}", new { name = "Build day", description = "Renamed." });
        var start = DateTimeOffset.UtcNow.AddDays(30);
        var (_, hub) = await HubFromAsync(admin, id, start);

        Assert.Equal("Build something real together.", Section(hub, "Hero").GetProperty("content").GetProperty("subtitle").GetString());
        Assert.Equal(start.AddMinutes(30),
            Section(hub, "Agenda").GetProperty("content").GetProperty("items")[0].GetProperty("startsAt").GetDateTimeOffset());
        Assert.True(Section(hub, "Rules").GetProperty("visible").GetBoolean());
        Assert.False(Section(hub, "Venue").GetProperty("visible").GetBoolean());

        await admin.PostAsync($"{Templates}/{id}/archive", null);
        var earlier = await admin.GetFromJsonAsync<JsonElement>($"/api/events/{earlierId}/hub");
        Assert.Equal("One day to build for the church.", Section(earlier, "Hero").GetProperty("content").GetProperty("subtitle").GetString());
        Assert.True(Section(earlier, "Venue").GetProperty("visible").GetBoolean());
        Assert.DoesNotContain(earlier.GetProperty("sections").EnumerateArray(), s => s.GetProperty("kind").GetString() == "Rules");
        Assert.Equal(2, (await ListAsync(admin, archived: true)).Single().GetProperty("hubCount").GetInt32());
    }

    // L2-184 AC3, L2-185 AC6, L2-186 AC6, ADR 0043: ManageRoles reads; only ManageOrganisationSettings writes; hub managers neither.
    [Fact]
    public async Task Only_settings_holders_change_templates_and_hub_managers_cannot_read_them_here()
    {
        var settings = factory.ClientWithCapabilities(await factory.AddMemberAsync("Priya Shah"), Capability.ManageOrganisationSettings);
        var reader = factory.ClientWithCapabilities(await factory.AddMemberAsync("Marcus Lee"), Capability.ManageRoles);
        var lead = factory.ClientWithCapabilities(await factory.AddMemberAsync("Grace Okonkwo"), Capability.ManageEventHubs);
        var hackathon = (await ListAsync(settings)).Single(t => t.GetProperty("name").GetString() == "Hackathon");
        var path = $"{Templates}/{Id(hackathon)}";

        Assert.Equal(HttpStatusCode.OK, (await reader.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.GetAsync(Templates)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Templates)).StatusCode);
        foreach (var client in new[] { reader, lead })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync(Templates, new { name = "Retreat" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(path, new { name = "Build day" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"{path}/sections", new { shown = new[] { "Hero" } })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"{path}/sections/Hero", new { subtitle = "x" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"{path}/archive", null)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"{path}/restore", null)).StatusCode);
        }

        // The FaithTech seed is the regression case: its Hackathon reads with its defaults (L2-171 AC2, L2-183 AC1).
        var detail = await settings.GetFromJsonAsync<JsonElement>(path);
        Assert.Equal(17, detail.GetProperty("sections").GetArrayLength());
        Assert.Equal("The Create Cycle", Section(detail, "Process").GetProperty("content").GetProperty("name").GetString());
        Assert.Equal(0, Section(detail, "Agenda").GetProperty("content").GetProperty("items")[0].GetProperty("minutes").GetInt32());
        Assert.Equal("FaithTech", detail.GetProperty("organisation").GetProperty("shortName").GetString());
    }

    // L2-184 AC3, L2-185 AC6: another organisation's template is not found, read or written.
    [Fact]
    public async Task Another_organisations_template_is_not_found()
    {
        var settings = factory.ClientWithCapabilities(await factory.AddMemberAsync("Priya Shah"), Capability.ManageOrganisationSettings);
        var hackathon = Id((await ListAsync(settings)).Single(t => t.GetProperty("name").GetString() == "Hackathon"));
        var northside = await factory.NorthsideClientAsync(Role.SystemAdmin);

        Assert.Empty(await ListAsync(northside));
        Assert.Equal(HttpStatusCode.NotFound, (await northside.GetAsync($"{Templates}/{hackathon}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await northside.PutAsJsonAsync($"{Templates}/{hackathon}", new { name = "Mine" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await northside.PutAsJsonAsync($"{Templates}/{hackathon}/sections/Hero", new { subtitle = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await northside.PostAsync($"{Templates}/{hackathon}/archive", null)).StatusCode);
    }

    // L2-185 AC6, L2-152: template changes are listed in the organisation audit's Stages & types category.
    [Fact]
    public async Task Template_changes_appear_in_the_stages_and_types_audit_category()
    {
        var (admin, _) = await FreshAsync();
        await AddAsync(admin, "Prayer night");

        var page = await admin.GetFromJsonAsync<JsonElement>("/api/admin/audit?category=taxonomies");

        Assert.Contains(page.GetProperty("items").EnumerateArray(), e => e.GetProperty("action").GetString() == "hub_template.updated");
    }
}
