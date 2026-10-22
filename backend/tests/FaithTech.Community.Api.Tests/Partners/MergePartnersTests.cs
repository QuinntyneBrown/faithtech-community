// Traces to: L2-089, L2-090, L2-087 (docs/detailed-designs/partners/duplicate-detection-and-merge, ADR 0024)
//
// Given a City Lead, Event Lead, Create Lead, Communications Lead or System Admin, when they merge
// two partners, then the merge is allowed (L2-090 AC1).
// Given per-field choices, when the merge completes, then the kept record takes the chosen values,
// a missing choice keeps its own, and the notes are the kept record's then the other's (L2-089 AC1, AC2).
// Given both records have timelines and stage histories, when merged, then every row is on the kept
// record remembering where it came from, a Merged entry tops the kept timeline, and the other record
// is archived pointing at the kept one (AC3).
// Given an archived partner, then it is left off the board, out of search and duplicate checks, its
// page still answers with who merged it, and edits, moves and logged activities answer 409 (AC4, AC7,
// L2-087 AC6).
// Given either record changed after the dialog opened, when the lead confirms, then 409 and nothing
// changes (AC5). Given joined notes over 2,000 characters, then 400.
// Given Staff or another member, then 403 and nothing changes; anonymous 401 (L2-090 AC2).
// Given any merge, then a partners.merged audit entry records who, both partners and the choices (AC3).
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static FaithTech.Community.Api.Tests.Partners.PartnerClients;

namespace FaithTech.Community.Api.Tests.Partners;

public class MergePartnersTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private static string Unique() => Guid.NewGuid().ToString("N")[..8];

    private string Today => DateOnly.FromDateTime(factory.Time.GetUtcNow().UtcDateTime).ToString("yyyy-MM-dd");

    private async Task<Partner> AddAsync(ProfileClients.Member lead, object body)
    {
        var response = await factory.ClientFor(lead, Role.CityLead).PostAsJsonAsync("/api/partners", body);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Partner>())!;
    }

    /// <summary>Kestrel Labs (In funnel, owned by Grace) and its duplicate Kestrel Labs Inc. (Lead, owned by Esther).</summary>
    private async Task<(ProfileClients.Member Grace, ProfileClients.Member Esther, Partner Kept, Partner Other)> PairAsync()
    {
        var u = Unique();
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var esther = await factory.AddMemberAsync("Esther Nakamura");
        factory.ClientFor(esther, Role.CityLead);
        var kept = await AddAsync(grace, new
        {
            Name = $"Kestrel {u} Labs",
            Website = $"kestrel-{u}.example",
            Offering = "Venue for Builders Night",
            OwnerId = grace.ProfileId,
            ContactName = "Nadia Petrov",
            Email = "nadia@kestrel.example",
            Notes = "Studio of 12 developers.",
            Stage = "InFunnel",
        });
        var other = await AddAsync(esther, new
        {
            Name = $"Kestrel {u} Labs Inc.",
            Website = $"https://www.kestrel-{u}.example",
            Offering = "Venue for Builders Night",
            OwnerId = esther.ProfileId,
            ContactName = "N. Petrov",
            Email = "nadia@kestrel.example",
            Phone = "416-555-0199",
            Notes = "Met Nadia at the spring builders night.",
        });
        // Later entries sort above the Added entries, as they would in real time.
        factory.Time.Advance(TimeSpan.FromMinutes(1));
        return (grace, esther, kept, other);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.EventLead)]
    [InlineData(Role.CreateLead)]
    [InlineData(Role.CommunicationsLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Each_lead_role_and_a_system_admin_may_merge(Role role)
    {
        var (_, _, kept, other) = await PairAsync();
        var caller = factory.ClientFor(await factory.AddMemberAsync("Marcus Lee"), role);

        var response = await caller.MergeAsync(kept.Id, MergeBody(kept, other));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(kept.Id, (await response.Content.ReadFromJsonAsync<Partner>())!.Id);
    }

    [Fact]
    public async Task The_kept_record_takes_the_chosen_values_and_both_notes()
    {
        var (grace, esther, kept, other) = await PairAsync();

        var response = await factory.ClientFor(grace, Role.CityLead).MergeAsync(
            kept.Id, MergeBody(kept, other, new { Phone = "other", Owner = "other", ContactName = "keep", Name = "keep" }));

        var merged = (await response.Content.ReadFromJsonAsync<Partner>())!;
        Assert.Equal(
            (kept.Name, "Nadia Petrov", "416-555-0199", esther.ProfileId, "InFunnel", kept.Website),
            (merged.Name, merged.ContactName, merged.Phone, merged.OwnerId, merged.Stage, merged.Website));
        Assert.Equal("Studio of 12 developers.\n\nMet Nadia at the spring builders night.", merged.Notes);
        Assert.True(merged.Version > kept.Version);
        Assert.Null(merged.Archived);
    }

    [Fact]
    public async Task Both_timelines_and_stage_histories_end_on_the_kept_record_with_a_merged_entry()
    {
        var (grace, esther, kept, other) = await PairAsync();
        var lead = factory.ClientFor(esther, Role.CityLead);
        (await lead.LogActivityAsync(other.Id, NewActivity(summary: "Called about hosting.", occurredOn: Today))).EnsureSuccessStatusCode();
        (await lead.PostAsJsonAsync($"/api/partners/{other.Id}/stage", new { To = "InFunnel", Note = "Proposal sent." })).EnsureSuccessStatusCode();
        other = await lead.GetPartnerAsync(other.Id);
        factory.Time.Advance(TimeSpan.FromMinutes(1));

        var response = await factory.ClientFor(grace, Role.CityLead).MergeAsync(kept.Id, MergeBody(kept, other));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var timeline = (await lead.ActivitiesAsync(kept.Id)).Items;
        var merged = timeline[0];
        Assert.Equal(("Merged", $"Merged {other.Name} into {kept.Name}", other.Id, other.Name), (merged.Kind, merged.Text, merged.RelatedPartnerId, merged.RelatedPartnerName));
        Assert.Null(merged.MergedFromPartnerId);
        var moved = timeline.Where(a => a.MergedFromPartnerId == other.Id).ToList();
        Assert.Equal(["Added", "Call", "StageMoved"], moved.Select(a => a.Kind).Order());
        Assert.All(moved, a => Assert.Equal(other.Name, a.MergedFromPartnerName));
        Assert.Contains(moved, a => a.Text == $"Added {other.Name} as a lead");
        Assert.Contains(moved, a => a.Text == $"Moved {other.Name} from Lead to In funnel: “Proposal sent.”");
        Assert.Contains(timeline, a => a.Kind == "Added" && a.MergedFromPartnerId is null);
        Assert.Empty((await lead.ActivitiesAsync(other.Id)).Items);
        var changes = await factory.WithDbAsync(db => db.PartnerStageChanges.Where(c => c.MergedFromPartnerId == other.Id).ToListAsync());
        Assert.Equal(kept.Id, Assert.Single(changes).PartnerId);
    }

    [Fact]
    public async Task Choosing_the_other_stage_records_it_on_the_merged_entry_without_a_stage_change()
    {
        var (grace, _, kept, other) = await PairAsync();

        var response = await factory.ClientFor(grace, Role.CityLead).MergeAsync(kept.Id, MergeBody(kept, other, new { Stage = "other" }));

        Assert.Equal("Lead", (await response.Content.ReadFromJsonAsync<Partner>())!.Stage);
        var merged = (await factory.ClientFor(grace).ActivitiesAsync(kept.Id)).Items[0];
        Assert.Equal(("InFunnel", "Lead"), (merged.FromStage, merged.ToStage));
        Assert.False(await factory.WithDbAsync(db => db.PartnerStageChanges.AnyAsync(c => c.PartnerId == kept.Id)));
    }

    [Fact]
    public async Task The_other_record_is_archived_and_left_off_the_board_search_and_duplicate_checks()
    {
        var (grace, _, kept, other) = await PairAsync();
        var lead = factory.ClientFor(grace, Role.CityLead);
        Assert.Single((await lead.DuplicatesAsync(kept.Id)).Matches);

        await lead.MergeAsync(kept.Id, MergeBody(kept, other));

        var archived = await lead.GetPartnerAsync(other.Id);
        Assert.NotNull(archived.Archived);
        var merged = await lead.GetPartnerAsync(kept.Id);
        Assert.Equal(
            (kept.Id, kept.Name, merged.Version, grace.ProfileId, "Grace Okonkwo", factory.Time.GetUtcNow().UtcDateTime),
            (archived.Archived!.MergedIntoId, archived.Archived.MergedIntoName, archived.Archived.MergedIntoVersion,
                archived.Archived.MergedById, archived.Archived.MergedByName, archived.Archived.MergedAtUtc));
        Assert.Equal((false, false, false), (archived.CanEdit, archived.CanLogActivity, archived.CanRestore));
        var board = (await lead.GetFromJsonAsync<Board>("/api/partners"))!;
        Assert.DoesNotContain(board.Columns.SelectMany(c => c.Cards), c => c.Id == other.Id);
        Assert.Contains(board.Columns.SelectMany(c => c.Cards), c => c.Id == kept.Id);
        var search = await lead.GetStringAsync($"/api/search?q={Uri.EscapeDataString(other.Name.Split(' ')[1])}");
        Assert.DoesNotContain(other.Id.ToString(), search);
        Assert.Contains(kept.Id.ToString(), search);
        Assert.Empty((await lead.DuplicatesAsync(kept.Id)).Matches);
        Assert.Empty((await lead.DuplicatesAsync(other.Id)).Matches);
    }

    [Fact]
    public async Task A_system_admin_sees_restore_on_an_archived_partner()
    {
        var (grace, _, kept, other) = await PairAsync();
        await factory.ClientFor(grace, Role.CityLead).MergeAsync(kept.Id, MergeBody(kept, other));

        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);

        Assert.True((await admin.GetPartnerAsync(other.Id)).CanRestore);
        Assert.False((await admin.GetPartnerAsync(kept.Id)).CanRestore);
    }

    [Fact]
    public async Task An_archived_partner_refuses_edits_moves_and_logged_activities()
    {
        var (grace, _, kept, other) = await PairAsync();
        var lead = factory.ClientFor(grace, Role.CityLead);
        await lead.MergeAsync(kept.Id, MergeBody(kept, other));

        var edit = await lead.PutAsJsonAsync($"/api/partners/{other.Id}", NewPartner("Renamed"));
        var move = await lead.PostAsJsonAsync($"/api/partners/{other.Id}/stage", new { To = "Confirmed" });
        var log = await lead.LogActivityAsync(other.Id, NewActivity(occurredOn: Today));

        Assert.Equal(
            (HttpStatusCode.Conflict, HttpStatusCode.Conflict, HttpStatusCode.Conflict),
            (edit.StatusCode, move.StatusCode, log.StatusCode));
        Assert.Equal(
            $"{other.Name} was merged into {kept.Name}. Log it there.",
            (await log.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal(other.Name, (await lead.GetPartnerAsync(other.Id)).Name);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_record_that_changed_since_the_dialog_opened_answers_409_and_nothing_changes(bool keptChanged)
    {
        var (grace, _, kept, other) = await PairAsync();
        var lead = factory.ClientFor(grace, Role.CityLead);
        var changed = keptChanged ? kept : other;
        (await lead.PostAsJsonAsync($"/api/partners/{changed.Id}/stage", new { To = "Confirmed" })).EnsureSuccessStatusCode();

        var response = await lead.MergeAsync(kept.Id, MergeBody(kept, other, new { Name = "other" }));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<ProblemDetails>())!;
        Assert.Equal($"Someone changed {changed.Name} while you were comparing. Nothing was changed; reload and try again.", problem.Detail);
        Assert.Equal(changed.Id.ToString(), problem.Extensions["partnerId"]!.ToString());
        Assert.Null((await lead.GetPartnerAsync(other.Id)).Archived);
        Assert.Equal(kept.Name, (await lead.GetPartnerAsync(kept.Id)).Name);
    }

    [Fact]
    public async Task Joined_notes_over_2000_characters_answer_400()
    {
        var (grace, _, kept, other) = await PairAsync();
        var lead = factory.ClientFor(grace, Role.CityLead);
        var long1 = new string('a', 1200);
        (await lead.PutAsJsonAsync($"/api/partners/{kept.Id}", new { kept.Name, kept.Website, Notes = long1 })).EnsureSuccessStatusCode();
        (await lead.PutAsJsonAsync($"/api/partners/{other.Id}", new { other.Name, other.Website, Notes = long1 })).EnsureSuccessStatusCode();
        kept = await lead.GetPartnerAsync(kept.Id);
        other = await lead.GetPartnerAsync(other.Id);

        var response = await lead.MergeAsync(kept.Id, MergeBody(kept, other));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>())!;
        Assert.Equal(
            ["The joined notes are longer than 2,000 characters. Shorten the notes on one partner, then merge."],
            problem.Errors["Notes"]);
        Assert.Null((await lead.GetPartnerAsync(other.Id)).Archived);
    }

    [Fact]
    public async Task A_choice_other_than_keep_or_other_answers_400()
    {
        var (grace, _, kept, other) = await PairAsync();

        var response = await factory.ClientFor(grace, Role.CityLead).MergeAsync(kept.Id, MergeBody(kept, other, new { Name = "both" }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Merging_a_partner_into_itself_is_400_an_unknown_one_404_and_an_archived_one_409()
    {
        var (grace, _, kept, other) = await PairAsync();
        var lead = factory.ClientFor(grace, Role.CityLead);

        var self = await lead.MergeAsync(kept.Id, MergeBody(kept, kept));
        var unknown = await lead.MergeAsync(Guid.NewGuid(), MergeBody(kept, other));
        await lead.MergeAsync(kept.Id, MergeBody(kept, other));
        var again = await lead.MergeAsync(kept.Id, MergeBody(await lead.GetPartnerAsync(kept.Id), other));

        Assert.Equal(
            (HttpStatusCode.BadRequest, HttpStatusCode.NotFound, HttpStatusCode.Conflict),
            (self.StatusCode, unknown.StatusCode, again.StatusCode));
        Assert.Equal($"{other.Name} has already been merged.", (await again.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
    }

    [Fact]
    public async Task Staff_and_other_members_get_403_anonymous_401_and_nothing_changes()
    {
        var (grace, _, kept, other) = await PairAsync();
        var staff = factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), Role.Staff);
        var volunteer = factory.ClientFor(await factory.AddMemberAsync("Ruth Alvarez"), Role.Volunteer);

        var byStaff = await staff.MergeAsync(kept.Id, MergeBody(kept, other));
        var byVolunteer = await volunteer.MergeAsync(kept.Id, MergeBody(kept, other));
        var anonymous = await factory.CreateClient().MergeAsync(kept.Id, MergeBody(kept, other));

        Assert.Equal(
            (HttpStatusCode.Forbidden, HttpStatusCode.Forbidden, HttpStatusCode.Unauthorized),
            (byStaff.StatusCode, byVolunteer.StatusCode, anonymous.StatusCode));
        Assert.Null((await factory.ClientFor(grace).GetPartnerAsync(other.Id)).Archived);
    }

    [Theory]
    [InlineData(Role.CityLead)]
    [InlineData(Role.SystemAdmin)]
    public async Task Every_merge_is_audited_with_both_partners_and_the_choices(Role role)
    {
        var (_, _, kept, other) = await PairAsync();
        var marcus = await factory.AddMemberAsync("Marcus Lee");

        await factory.ClientFor(marcus, role).MergeAsync(kept.Id, MergeBody(kept, other, new { Phone = "other" }));

        var entry = Assert.Single(await factory.WithDbAsync(db => db.AuditEntries
            .Where(e => e.TargetId == kept.Id.ToString() && e.Action == "partners.merged").ToListAsync()));
        Assert.Equal((marcus.ProfileId, "Partner"), (entry.ActorId, entry.TargetType));
        Assert.Contains(other.Id.ToString(), entry.AfterJson);
        Assert.Contains("416-555-0199", entry.AfterJson);
        Assert.Contains(other.Name, entry.BeforeJson);
        Assert.Contains(kept.Name, entry.BeforeJson);
    }
}
