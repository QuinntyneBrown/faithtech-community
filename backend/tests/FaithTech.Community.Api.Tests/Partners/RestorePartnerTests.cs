// Traces to: L2-090 (docs/detailed-designs/partners/duplicate-detection-and-merge, ADR 0024)
//
// Given an archived partner, when a System Admin restores it, then it is active again at its old
// stage, every timeline entry and stage change that came from it moves back, both partners get a
// Restored entry and partner.restored is audited (AC4); the kept record keeps the merged values.
// Given a City Lead, Staff or another member, then 403 and nothing changes; anonymous 401 (AC5).
// Given either record changed since the page loaded, then 409 and nothing changes (AC6).
// Given an active partner, then 409. Given a chain A into B into C, then A is restored only after
// B, and A's rows come back from C.
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Partners.PartnerClients;

namespace FaithTech.Community.Api.Tests.Partners;

public class RestorePartnerTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Unique() => Guid.NewGuid().ToString("N")[..8];

    private string Today => DateOnly.FromDateTime(factory.Time.GetUtcNow().UtcDateTime).ToString("yyyy-MM-dd");

    private HttpClient Admin(ProfileClients.Member admin) => factory.ClientFor(admin, Role.SystemAdmin);

    /// <summary>Kestrel Labs (In funnel) with Kestrel Labs Inc. (Lead, one call and one move) merged into it.</summary>
    private async Task<(ProfileClients.Member Grace, Partner Kept, Partner Other)> MergedPairAsync()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var lead = factory.ClientFor(grace, Role.CityLead);
        var kept = await factory.CreatePartnerAsync(grace, $"Kestrel {u} Labs", "InFunnel");
        var other = await factory.CreatePartnerAsync(grace, $"Kestrel {u} Labs Inc.", "Lead");
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        (await lead.LogActivityAsync(other.Id, NewActivity(summary: "Called about hosting.", occurredOn: Today))).EnsureSuccessStatusCode();
        (await lead.PostAsJsonAsync($"/api/partners/{other.Id}/stage", new { To = "Confirmed" })).EnsureSuccessStatusCode();
        (await lead.PostAsJsonAsync($"/api/partners/{other.Id}/stage", new { To = "Lead" })).EnsureSuccessStatusCode();
        other = await lead.GetPartnerAsync(other.Id);
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        (await lead.MergeAsync(kept.Id, MergeBody(kept, other, new { Phone = "other" }))).EnsureSuccessStatusCode();
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        return (grace, await lead.GetPartnerAsync(kept.Id), await lead.GetPartnerAsync(other.Id));
    }

    private static object RestoreBody(Partner archived, int? version = null, int? mergedIntoVersion = null) => new
    {
        Version = version ?? archived.Version,
        MergedIntoVersion = mergedIntoVersion ?? archived.Archived!.MergedIntoVersion,
    };

    private static Task<HttpResponseMessage> RestoreAsync(HttpClient client, Guid id, object body) =>
        client.PostAsJsonAsync($"/api/partners/{id}/restore", body);

    [Fact]
    public async Task A_system_admin_restores_a_merged_partner_and_its_rows_move_back()
    {
        var (grace, kept, other) = await MergedPairAsync();
        var priya = await factory.AddMemberAsync("Priya Shah");

        var response = await RestoreAsync(Admin(priya), other.Id, RestoreBody(other));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var restored = (await response.Content.ReadFromJsonAsync<Partner>())!;
        Assert.Equal((other.Id, "Lead", (Archived?)null, false), (restored.Id, restored.Stage, restored.Archived, restored.CanRestore));
        Assert.True(restored.Version > other.Version);
        var lead = factory.ClientFor(grace, Role.CityLead);
        var own = (await lead.ActivitiesAsync(other.Id)).Items;
        Assert.Equal(("Restored", $"Restored {other.Name} from {kept.Name}", kept.Id), (own[0].Kind, own[0].Text, own[0].RelatedPartnerId));
        Assert.Equal(["Added", "Call", "StageMoved", "StageMoved"], own.Skip(1).Select(a => a.Kind).Order());
        Assert.All(own, a => Assert.Null(a.MergedFromPartnerId));
        var keptTimeline = (await lead.ActivitiesAsync(kept.Id)).Items;
        Assert.Equal(("Restored", $"Restored {other.Name} as its own partner"), (keptTimeline[0].Kind, keptTimeline[0].Text));
        Assert.Equal(["Added", "Merged", "Restored"], keptTimeline.Select(a => a.Kind).Order());
        Assert.Equal(2, await factory.WithDbAsync(db => db.PartnerStageChanges.CountAsync(c => c.PartnerId == other.Id && c.MergedFromPartnerId == null)));
        var keptNow = await lead.GetPartnerAsync(kept.Id);
        Assert.Equal(("416-555-0199", kept.Notes), (keptNow.Phone, keptNow.Notes));
        Assert.True(keptNow.Version > kept.Version);
        var board = (await lead.GetFromJsonAsync<Board>("/api/partners"))!;
        Assert.Contains(board.Columns.SelectMany(c => c.Cards), c => c.Id == other.Id);
        var entry = Assert.Single(await factory.WithDbAsync(db => db.AuditEntries
            .Where(e => e.TargetId == other.Id.ToString() && e.Action == "partner.restored").ToListAsync()));
        Assert.Equal((priya.ProfileId, "Partner"), (entry.ActorId, entry.TargetType));
        Assert.Contains(kept.Id.ToString(), entry.BeforeJson);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.Staff)]
    [InlineData(Role.Volunteer)]
    public async Task Anyone_but_a_system_admin_gets_403_and_nothing_changes(Role role)
    {
        var (grace, _, other) = await MergedPairAsync();
        var caller = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), role);

        var response = await RestoreAsync(caller, other.Id, RestoreBody(other));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.NotNull((await factory.ClientFor(grace).GetPartnerAsync(other.Id)).Archived);
        Assert.Equal(HttpStatusCode.Unauthorized, (await RestoreAsync(factory.CreateClient(), other.Id, RestoreBody(other))).StatusCode);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_stale_version_answers_409_and_nothing_changes(bool archivedStale)
    {
        var (grace, _, other) = await MergedPairAsync();
        var priya = await factory.AddMemberAsync("Priya Shah");
        var body = archivedStale
            ? RestoreBody(other, version: other.Version - 1)
            : RestoreBody(other, mergedIntoVersion: other.Archived!.MergedIntoVersion - 1);

        var response = await RestoreAsync(Admin(priya), other.Id, body);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(
            "Someone changed these partners since the page loaded. Nothing was changed; reload and try again.",
            (await response.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.NotNull((await factory.ClientFor(grace).GetPartnerAsync(other.Id)).Archived);
    }

    [Fact]
    public async Task Restoring_an_active_partner_answers_409_and_an_unknown_one_404()
    {
        var (_, kept, _) = await MergedPairAsync();
        var admin = Admin(await factory.AddMemberAsync("Priya Shah"));

        var active = await RestoreAsync(admin, kept.Id, new { kept.Version, MergedIntoVersion = 0 });
        var unknown = await RestoreAsync(admin, Guid.NewGuid(), new { Version = 0, MergedIntoVersion = 0 });

        Assert.Equal((HttpStatusCode.Conflict, HttpStatusCode.NotFound), (active.StatusCode, unknown.StatusCode));
        Assert.Equal($"{kept.Name} is not archived.", (await active.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task In_a_chain_a_into_b_into_c_a_waits_for_b_and_its_rows_come_back_from_c()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var lead = factory.ClientFor(grace, Role.CityLead);
        var a = await factory.CreatePartnerAsync(grace, $"A {u}");
        var b = await factory.CreatePartnerAsync(grace, $"B {u}");
        var c = await factory.CreatePartnerAsync(grace, $"C {u}");
        (await lead.LogActivityAsync(a.Id, NewActivity(summary: "A's call.", occurredOn: Today))).EnsureSuccessStatusCode();
        a = await lead.GetPartnerAsync(a.Id);
        (await lead.MergeAsync(b.Id, MergeBody(b, a))).EnsureSuccessStatusCode();
        b = await lead.GetPartnerAsync(b.Id);
        (await lead.MergeAsync(c.Id, MergeBody(c, b))).EnsureSuccessStatusCode();
        var admin = Admin(await factory.AddMemberAsync("Priya Shah"));
        a = await lead.GetPartnerAsync(a.Id);

        var tooEarly = await RestoreAsync(admin, a.Id, RestoreBody(a));
        Assert.Equal(HttpStatusCode.Conflict, tooEarly.StatusCode);
        Assert.Equal($"Restore {b.Name} first.", (await tooEarly.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);

        b = await lead.GetPartnerAsync(b.Id);
        (await RestoreAsync(admin, b.Id, RestoreBody(b))).EnsureSuccessStatusCode();
        Assert.DoesNotContain((await lead.ActivitiesAsync(b.Id)).Items, x => x.Summary == "A's call.");
        Assert.Contains((await lead.ActivitiesAsync(c.Id)).Items, x => x.Summary == "A's call.");

        a = await lead.GetPartnerAsync(a.Id);
        (await RestoreAsync(admin, a.Id, RestoreBody(a))).EnsureSuccessStatusCode();
        Assert.Contains((await lead.ActivitiesAsync(a.Id)).Items, x => x.Summary == "A's call.");
        Assert.DoesNotContain((await lead.ActivitiesAsync(c.Id)).Items, x => x.Summary == "A's call.");
    }
}
