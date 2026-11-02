// Traces to: L2-189 AC2 to AC6, L2-190 AC3 to AC5
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

// Quick edits change the hub at once (ADR 0044); every rule is proven with a role defined in the test (ADR 0033).
public class HubQuickEditsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static string Update(Guid eventId) => $"{Hub(eventId)}/update";

    private async Task<HttpClient> HolderAsync(string name = "Grace Okonkwo") =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync(name), Capability.ManageEventHubs);

    /// <summary>A public event a week away with a published hub, and a holder who manages it.</summary>
    private async Task<(Event Event, HttpClient Holder)> HubAsync(string title = "Builders Night")
    {
        var e = await factory.AddEventAsync(title, TimeSpan.FromDays(7), visibility: EventVisibility.Public);
        var holder = await HolderAsync();
        Assert.Equal(HttpStatusCode.Created, (await holder.PostAsync(Hub(e.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await holder.PostAsync($"{Hub(e.Id)}/publish", null)).StatusCode);
        return (e, holder);
    }

    private static async Task<IDictionary<string, string[]>> ErrorsOf(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors;
    }

    private Task<int> OverridesAsync(Guid eventId, Guid actor) =>
        factory.WithDbAsync(async db =>
        {
            var hubId = (await db.EventHubs.SingleAsync(h => h.EventId == eventId)).Id.ToString();
            return await db.AuditEntries.CountAsync(a => a.TargetId == hubId && a.Action == "event_hub.updated" && a.ActorId == actor);
        });

    // L2-189 AC3, AC5: a posted update is trimmed, read by the hub home and by anonymous visitors on the page.
    [Fact]
    public async Task A_posted_update_is_trimmed_and_shown_on_the_hub_home_and_to_anonymous_visitors()
    {
        var (e, holder) = await HubAsync();

        var response = await holder.PutAsJsonAsync(Update(e.Id), new { text = "  Dinner has moved   to the courtyard.  " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("Dinner has moved to the courtyard.",
            (await holder.GetFromJsonAsync<JsonElement>(Hub(e.Id))).GetProperty("updateBanner").GetString());
        Assert.Equal("Dinner has moved to the courtyard.",
            (await factory.CreateClient().GetFromJsonAsync<JsonElement>($"{Hub(e.Id)}/page")).GetProperty("updateBanner").GetString());
    }

    // L2-189 AC4, AC5: clearing removes it at once; a hub without one answers null; clearing again is still 204.
    [Fact]
    public async Task Clearing_the_update_removes_it_and_clearing_again_is_harmless()
    {
        var (e, holder) = await HubAsync();
        await holder.PutAsJsonAsync(Update(e.Id), new { text = "Doors open at 6:45 pm." });

        Assert.Equal(HttpStatusCode.NoContent, (await holder.DeleteAsync(Update(e.Id))).StatusCode);

        Assert.Equal(JsonValueKind.Null,
            (await factory.CreateClient().GetFromJsonAsync<JsonElement>($"{Hub(e.Id)}/page")).GetProperty("updateBanner").ValueKind);
        Assert.Equal(HttpStatusCode.NoContent, (await holder.DeleteAsync(Update(e.Id))).StatusCode);
    }

    // L2-189 AC2: the text is required and at most 280 characters.
    [Fact]
    public async Task An_update_must_have_text_of_at_most_280_characters()
    {
        var (e, holder) = await HubAsync();

        Assert.Equal(["Write the update."], (await ErrorsOf(await holder.PutAsJsonAsync(Update(e.Id), new { text = "   " })))["text"]);
        Assert.Equal(["Write the update."], (await ErrorsOf(await holder.PutAsJsonAsync(Update(e.Id), new { })))["text"]);
        Assert.Equal(["Use 280 characters or fewer."],
            (await ErrorsOf(await holder.PutAsJsonAsync(Update(e.Id), new { text = new string('a', 281) })))["text"]);
        Assert.Equal(HttpStatusCode.NoContent, (await holder.PutAsJsonAsync(Update(e.Id), new { text = new string('a', 280) })).StatusCode);
    }

    // L2-189 AC6: without ManageEventHubs it is 403 and nothing changes; an administrator's override is audited.
    [Fact]
    public async Task Without_ManageEventHubs_the_update_is_403_and_an_administrator_override_is_audited()
    {
        var (e, holder) = await HubAsync();
        await holder.PutAsJsonAsync(Update(e.Id), new { text = "Doors open at 6:45 pm." });
        var other = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);
        var adminMember = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientWithCapabilities(adminMember, Capability.AdministerOrganisation);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutAsJsonAsync(Update(e.Id), new { text = "Gone home." })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.DeleteAsync(Update(e.Id))).StatusCode);
        Assert.Equal("Doors open at 6:45 pm.", (await holder.GetFromJsonAsync<JsonElement>(Hub(e.Id))).GetProperty("updateBanner").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync(Update(e.Id), new { text = "Doors open at 7 pm." })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync(Update(e.Id))).StatusCode);
        Assert.Equal(2, await OverridesAsync(e.Id, adminMember.ProfileId));
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().PutAsJsonAsync(Update(e.Id), new { text = "x" })).StatusCode);
    }

    // L2-189 AC6: an event without a hub and another organisation's event are 404.
    [Fact]
    public async Task An_event_without_a_hub_and_another_organisations_event_are_404()
    {
        var bare = await factory.AddEventAsync("No Hub Night", TimeSpan.FromDays(7));
        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        var start = factory.Time.GetUtcNow().AddDays(10);
        var theirs = await (await northside.PostAsJsonAsync("/api/events", new
        {
            title = Isolation.Marker(), description = "An evening.", type = "builders-night", startsAt = start, endsAt = start.AddHours(2),
            city = "Toronto", format = "InPerson", venue = "Kestrel Labs", onlineLink = (string?)null, capacity = 60, visibility = "Public",
        })).CreatedIdAsync();
        Assert.Equal(HttpStatusCode.Created, (await northside.PostAsync(Hub(theirs), null)).StatusCode);
        var admin = await factory.FaithTechAdminAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync(Update(bare.Id), new { text = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync(Update(theirs), new { text = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync(Update(theirs))).StatusCode);
    }

    private static string Move(Guid eventId) => $"{Hub(eventId)}/agenda/move";

    private static readonly (int Minutes, string Title)[] Agenda =
        [(0, "Doors open"), (30, "Build time"), (90, "Code freeze"), (105, "Demos and feedback"), (135, "Wrap up and prayer")];

    /// <summary>A hub whose Agenda has the five rows from the event's start, and whose code freeze is the Code freeze row.</summary>
    private async Task<(Event Event, HttpClient Holder)> AgendaHubAsync()
    {
        var (e, holder) = await HubAsync();
        var items = Agenda.Select(r => new { startsAt = e.StartsAt.AddMinutes(r.Minutes), title = r.Title, detail = (string?)null });
        Assert.Equal(HttpStatusCode.NoContent, (await holder.PutAsJsonAsync($"{Hub(e.Id)}/sections/Agenda", new { items })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await holder.PutAsJsonAsync($"{Hub(e.Id)}/sections/Links", new
        {
            submissionUrl = "https://forms.example.org/submit", feedbackUrl = (string?)null, codeFreezeAt = e.StartsAt.AddMinutes(90),
        })).StatusCode);
        return (e, holder);
    }

    /// <summary>Each agenda row as (minutes from the event's start, title), and the code freeze in minutes.</summary>
    private static async Task<((double Minutes, string Title)[] Rows, double? Freeze)> ScheduleAsync(HttpClient client, Event e)
    {
        var hub = await client.GetFromJsonAsync<JsonElement>(Hub(e.Id));
        JsonElement Content(string kind) => hub.GetProperty("sections").EnumerateArray()
            .Single(s => s.GetProperty("kind").GetString() == kind).GetProperty("content");
        var rows = Content("Agenda").GetProperty("items").EnumerateArray()
            .Select(i => ((i.GetProperty("startsAt").GetDateTimeOffset() - e.StartsAt).TotalMinutes, i.GetProperty("title").GetString()!))
            .ToArray();
        var freeze = Content("Links").GetProperty("codeFreezeAt");
        return (rows, freeze.ValueKind == JsonValueKind.Null ? null : (freeze.GetDateTimeOffset() - e.StartsAt).TotalMinutes);
    }

    // L2-190 AC3: moving Code freeze 30 minutes later with shiftLater moves the two later rows by 30 minutes too, and the
    // code freeze follows its row.
    [Fact]
    public async Task Moving_a_session_with_shiftLater_moves_the_later_rows_and_the_code_freeze_by_the_same_amount()
    {
        var (e, holder) = await AgendaHubAsync();

        var response = await holder.PostAsJsonAsync(Move(e.Id), new { index = 2, startsAt = e.StartsAt.AddMinutes(120), shiftLater = true });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var (rows, freeze) = await ScheduleAsync(holder, e);
        Assert.Equal([(0, "Doors open"), (30, "Build time"), (120, "Code freeze"), (135, "Demos and feedback"), (165, "Wrap up and prayer")], rows);
        Assert.Equal(120, freeze);
    }

    // L2-190 AC3: without shiftLater only the row moves; a move earlier works the same way; the freeze stays on its row.
    [Fact]
    public async Task Moving_a_session_without_shiftLater_moves_only_that_row()
    {
        var (e, holder) = await AgendaHubAsync();

        Assert.Equal(HttpStatusCode.NoContent,
            (await holder.PostAsJsonAsync(Move(e.Id), new { index = 1, startsAt = e.StartsAt.AddMinutes(15), shiftLater = false })).StatusCode);

        var (rows, freeze) = await ScheduleAsync(holder, e);
        Assert.Equal([(0, "Doors open"), (15, "Build time"), (90, "Code freeze"), (105, "Demos and feedback"), (135, "Wrap up and prayer")], rows);
        Assert.Equal(90, freeze);
    }

    // L2-190 AC4: the index must name a row and the time is required.
    [Fact]
    public async Task A_move_needs_a_row_of_the_agenda_and_a_time()
    {
        var (e, holder) = await AgendaHubAsync();

        Assert.Equal(["Choose a session from the agenda."],
            (await ErrorsOf(await holder.PostAsJsonAsync(Move(e.Id), new { index = 5, startsAt = e.StartsAt, shiftLater = false })))["index"]);
        Assert.Equal(["Choose a session from the agenda."],
            (await ErrorsOf(await holder.PostAsJsonAsync(Move(e.Id), new { startsAt = e.StartsAt, shiftLater = false })))["index"]);
        Assert.Equal(["Enter a time."],
            (await ErrorsOf(await holder.PostAsJsonAsync(Move(e.Id), new { index = 0, shiftLater = false })))["startsAt"]);
    }

    // L2-190 AC5: without ManageEventHubs it is 403 and nothing moves; an administrator's override is audited; another
    // organisation's event is 404.
    [Fact]
    public async Task Without_ManageEventHubs_a_move_is_403_an_override_is_audited_and_another_organisation_is_404()
    {
        var (e, holder) = await AgendaHubAsync();
        var other = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);
        var adminMember = await factory.AddMemberAsync("Priya Shah");
        var admin = factory.ClientWithCapabilities(adminMember, Capability.AdministerOrganisation);
        var northside = await factory.NorthsideClientAsync(Role.EventLead);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await other.PostAsJsonAsync(Move(e.Id), new { index = 0, startsAt = e.StartsAt.AddHours(1), shiftLater = true })).StatusCode);
        Assert.Equal(0, (await ScheduleAsync(holder, e)).Rows[0].Minutes);
        Assert.Equal(HttpStatusCode.NotFound,
            (await northside.PostAsJsonAsync(Move(e.Id), new { index = 0, startsAt = e.StartsAt.AddHours(1), shiftLater = true })).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PostAsJsonAsync(Move(e.Id), new { index = 0, startsAt = e.StartsAt.AddMinutes(10), shiftLater = false })).StatusCode);
        Assert.Equal(1, await OverridesAsync(e.Id, adminMember.ProfileId));
    }
}
