// Traces to: L2-164 AC1 to AC5
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Api.Tests.Organisations.Isolation;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Events;

// Every rule is proven with a role defined in the test (ADR 0033); the FaithTech seed is the regression case.
public class PublishEventHubTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Hub(Guid eventId) => $"/api/events/{eventId}/hub";

    private static string Publish(Guid eventId) => $"{Hub(eventId)}/publish";

    private static string Unpublish(Guid eventId) => $"{Hub(eventId)}/unpublish";

    private async Task<HttpClient> HolderAsync(string name = "Grace Okonkwo") =>
        factory.ClientWithCapabilities(await factory.AddMemberAsync(name), Capability.ManageEventHubs);

    /// <summary>An event a week away with a hub, and a holder who manages it.</summary>
    private async Task<(Guid EventId, HttpClient Holder)> HubAsync(string title = "Builders Night")
    {
        var e = await factory.AddEventAsync(title, TimeSpan.FromDays(7));
        var holder = await HolderAsync();
        Assert.Equal(HttpStatusCode.Created, (await holder.PostAsync(Hub(e.Id), null)).StatusCode);
        return (e.Id, holder);
    }

    private static async Task<JsonElement> HubOf(HttpClient client, Guid eventId) =>
        await client.GetFromJsonAsync<JsonElement>(Hub(eventId));

    private Task<List<(string Action, string? After)>> HubAuditAsync(Guid eventId) =>
        factory.WithDbAsync(async db =>
        {
            var hubId = (await db.EventHubs.SingleAsync(h => h.EventId == eventId)).Id.ToString();
            return (await db.AuditEntries.AsNoTracking()
                    .Where(a => a.TargetId == hubId && a.Action.StartsWith("event_hub.") && a.Action.EndsWith("published"))
                    .OrderBy(a => a.OccurredAtUtc).ToListAsync())
                .Select(a => (a.Action, a.AfterJson)).ToList();
        });

    // L2-164 AC1, AC2, AC5: publishing sets Published and the time, refuses nothing, and is audited.
    [Fact]
    public async Task Publishing_a_draft_hub_with_empty_sections_makes_it_published_now_and_audits_it()
    {
        var (eventId, holder) = await HubAsync();

        var response = await holder.PostAsync(Publish(eventId), null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var hub = await HubOf(holder, eventId);
        Assert.Equal("Published", hub.GetProperty("status").GetString());
        Assert.Equal(factory.Time.GetUtcNow(), hub.GetProperty("publishedAt").GetDateTimeOffset());
        var audit = Assert.Single(await HubAuditAsync(eventId));
        Assert.Equal("event_hub.published", audit.Action);
        Assert.Contains("\"Override\":false", audit.After);
    }

    // L2-164 AC5: publishing a published hub refreshes the time.
    [Fact]
    public async Task Publishing_again_refreshes_the_published_time()
    {
        var (eventId, holder) = await HubAsync();
        await holder.PostAsync(Publish(eventId), null);
        factory.Time.Advance(TimeSpan.FromMinutes(5));

        Assert.Equal(HttpStatusCode.NoContent, (await holder.PostAsync(Publish(eventId), null)).StatusCode);

        Assert.Equal(factory.Time.GetUtcNow(), (await HubOf(holder, eventId)).GetProperty("publishedAt").GetDateTimeOffset());
    }

    // L2-164 AC3, AC5: unpublishing returns the hub to Draft and keeps its sections; unpublishing a draft records nothing.
    [Fact]
    public async Task Unpublishing_returns_the_hub_to_draft_keeps_its_sections_and_is_audited_once()
    {
        var (eventId, holder) = await HubAsync();
        Assert.Equal(HttpStatusCode.NoContent,
            (await holder.PutAsJsonAsync($"{Hub(eventId)}/sections/Hero", new { subtitle = "A night of building" })).StatusCode);
        await holder.PostAsync(Publish(eventId), null);

        Assert.Equal(HttpStatusCode.NoContent, (await holder.PostAsync(Unpublish(eventId), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await holder.PostAsync(Unpublish(eventId), null)).StatusCode);

        var hub = await HubOf(holder, eventId);
        Assert.Equal("Draft", hub.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, hub.GetProperty("publishedAt").ValueKind);
        var hero = hub.GetProperty("sections").EnumerateArray().Single(s => s.GetProperty("kind").GetString() == "Hero");
        Assert.Equal("A night of building", hero.GetProperty("content").GetProperty("subtitle").GetString());
        Assert.Equal(["event_hub.published", "event_hub.unpublished"], (await HubAuditAsync(eventId)).Select(a => a.Action));
    }

    // L2-164 AC4: without the capability the answer is 403 and nothing changes.
    [Fact]
    public async Task Without_ManageEventHubs_publishing_and_unpublishing_are_403()
    {
        var (eventId, holder) = await HubAsync();
        var other = factory.ClientWithCapabilities(await factory.AddMemberAsync("Jonah Bell"), Capability.ManageEvents);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.PostAsync(Publish(eventId), null)).StatusCode);
        Assert.Equal("Draft", (await HubOf(holder, eventId)).GetProperty("status").GetString());

        await holder.PostAsync(Publish(eventId), null);
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PostAsync(Unpublish(eventId), null)).StatusCode);
        Assert.Equal("Published", (await HubOf(holder, eventId)).GetProperty("status").GetString());
    }

    // L2-164 AC4: an event without a hub, an unknown event and another organisation's hub are 404.
    [Fact]
    public async Task An_event_without_a_hub_an_unknown_event_and_another_organisations_hub_are_404()
    {
        var northside = await factory.NorthsideClientAsync(Role.EventLead);
        var start = factory.Time.GetUtcNow().AddDays(10);
        var theirs = await (await northside.PostAsync("/api/events", new
        {
            title = Isolation.Marker(), description = "An evening.", type = "builders-night", startsAt = start, endsAt = start.AddHours(2),
            city = "Toronto", format = "InPerson", venue = "Kestrel Labs", onlineLink = (string?)null, capacity = 60, visibility = "Public",
        })).CreatedIdAsync();
        Assert.Equal(HttpStatusCode.Created, (await northside.PostAsync(Hub(theirs), null)).StatusCode);
        var noHub = await factory.AddEventAsync("Prayer Breakfast", TimeSpan.FromDays(7));
        var admin = await factory.FaithTechAdminAsync();

        foreach (var path in new[] { Publish(theirs), Unpublish(theirs), Publish(Guid.NewGuid()), Publish(noHub.Id), Unpublish(noHub.Id) })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync(path, null)).StatusCode);
        }

        Assert.Equal("Draft", (await HubOf(northside, theirs)).GetProperty("status").GetString());
    }

    // L2-164 AC5: an administrator without the capability publishes as an override, marked in the audit entry.
    [Fact]
    public async Task An_administrator_without_ManageEventHubs_publishes_as_an_audited_override()
    {
        var (eventId, _) = await HubAsync();
        var admin = factory.ClientWithCapabilities(await factory.AddMemberAsync("Priya Shah"), Capability.AdministerOrganisation);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync(Publish(eventId), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync(Unpublish(eventId), null)).StatusCode);

        var audit = await HubAuditAsync(eventId);
        Assert.Equal(["event_hub.published", "event_hub.unpublished"], audit.Select(a => a.Action));
        Assert.All(audit, a => Assert.Contains("\"Override\":true", a.After));
    }

    // L2-164 AC1, L2-151: FaithTech's City Lead publishes; Staff cannot.
    [Fact]
    public async Task FaithTech_city_lead_publishes_and_staff_cannot()
    {
        var e = await factory.AddEventAsync("Toronto Builders Night", TimeSpan.FromDays(7));
        var cityLead = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), Role.CityLead);
        var staff = factory.ClientFor(await factory.AddMemberAsync("Jonah Bell"), Role.Staff);
        Assert.Equal(HttpStatusCode.Created, (await cityLead.PostAsync(Hub(e.Id), null)).StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PostAsync(Publish(e.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await cityLead.PostAsync(Publish(e.Id), null)).StatusCode);
    }
}
