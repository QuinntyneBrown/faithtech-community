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
}
