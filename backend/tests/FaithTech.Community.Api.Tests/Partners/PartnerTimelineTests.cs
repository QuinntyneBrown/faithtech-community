// Traces to: L2-110, L2-111 (docs/detailed-designs/partners/partner-activity-timeline)
//
// Given a new partner, then the system writes an Added entry; given a move, a Stage moved entry
// with from, to and the note. Given the timeline, then entries are newest first by date, time (none
// as the start of the day), log time; a kind filter lists only that kind (Stage includes Added);
// more than 50 page with "before" without repeats or gaps. Given logged next steps, then the
// partner and its card show the latest one, and Last activity is the latest entry's date.
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Partners;
using Partner = FaithTech.Community.Api.Tests.Partners.PartnerClients.Partner;
using FaithTech.Community.Domain.Profiles;
using static FaithTech.Community.Api.Tests.Partners.PartnerClients;

namespace FaithTech.Community.Api.Tests.Partners;

public class PartnerTimelineTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private DateTime Now => factory.Time.GetUtcNow().UtcDateTime;

    [Fact]
    public async Task Creating_a_partner_writes_an_added_entry_with_who_and_when()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var lead = await factory.CreatePartnerAsync(grace, "Maple Street Church");
        var funnel = await factory.CreatePartnerAsync(grace, "Lantern Foundation", "InFunnel");
        var client = factory.ClientFor(grace, Role.CityLead);

        var added = Assert.Single((await client.ActivitiesAsync(lead.Id)).Items);
        Assert.Equal(
            ("Added", "Added Maple Street Church as a lead", grace.ProfileId, "Grace Okonkwo", Now, DateOnly.FromDateTime(Now), (string?)"Lead"),
            (added.Kind, added.Text, added.LoggedById, added.LoggedByName, added.LoggedAtUtc, added.OccurredOn, added.ToStage));
        Assert.Equal("Added Lantern Foundation at In funnel", Assert.Single((await client.ActivitiesAsync(funnel.Id)).Items).Text);
    }

    [Fact]
    public async Task Moving_a_partner_writes_a_stage_moved_entry_with_the_note()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var partner = await factory.CreatePartnerAsync(grace, "Kestrel Labs");
        var client = factory.ClientFor(grace, Role.CityLead);
        factory.Time.Advance(TimeSpan.FromMinutes(1));

        await client.PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "InFunnel", Note = "Proposal sent." });

        var moved = (await client.ActivitiesAsync(partner.Id)).Items[0];
        Assert.Equal(
            ("StageMoved", "Moved Kestrel Labs from Lead to In funnel: “Proposal sent.”", "Lead", "InFunnel", "Proposal sent."),
            (moved.Kind, moved.Text, moved.FromStage, moved.ToStage, moved.Summary));
    }

    [Fact]
    public async Task Entries_are_newest_first_by_date_then_time_with_none_as_the_start_of_the_day_then_log_time()
    {
        var (grace, partner) = await PartnerAsync();
        var day = DateOnly.FromDateTime(Now).AddDays(-3);
        await SeedAsync(partner.Id, grace.ProfileId,
            ("no time", day, null, 0),
            ("morning", day, new TimeOnly(9, 0), 0),
            ("afternoon, logged first", day, new TimeOnly(14, 0), 0),
            ("afternoon, logged later", day, new TimeOnly(14, 0), 5),
            ("the day before", day.AddDays(-1), new TimeOnly(23, 0), 0));

        var page = await factory.ClientFor(grace, Role.CityLead).ActivitiesAsync(partner.Id, "?kind=Note");

        Assert.Equal(
            ["afternoon, logged later", "afternoon, logged first", "morning", "no time", "the day before"],
            page.Items.Select(a => a.Text));
    }

    [Theory]
    [InlineData("Call", new[] { "Call" })]
    [InlineData("Email", new[] { "Email" })]
    [InlineData("Meeting", new[] { "Meeting" })]
    [InlineData("Note", new[] { "Note" })]
    [InlineData("Stage", new[] { "StageMoved", "Added" })]
    public async Task A_kind_filter_lists_only_that_kind_and_stage_includes_added(string kind, string[] expected)
    {
        var (grace, partner) = await PartnerAsync();
        var client = factory.ClientFor(grace, Role.CityLead);
        foreach (var logged in new[] { "Call", "Email", "Meeting", "Note" })
        {
            await client.LogActivityAsync(partner.Id, NewActivity(logged, occurredOn: DateOnly.FromDateTime(Now).ToString("yyyy-MM-dd")));
        }

        factory.Time.Advance(TimeSpan.FromMinutes(1));
        await client.PostAsJsonAsync($"/api/partners/{partner.Id}/stage", new { To = "Confirmed" });

        var page = await client.ActivitiesAsync(partner.Id, $"?kind={kind}");

        Assert.Equal(expected, page.Items.Select(a => a.Kind));
        Assert.Equal(6, (await client.ActivitiesAsync(partner.Id)).Items.Length);
    }

    [Theory]
    [InlineData("?kind=Lunch")]
    [InlineData("?kind=StageMoved")]
    [InlineData("?before=not-a-cursor")]
    public async Task An_unknown_kind_or_a_broken_cursor_is_400(string query)
    {
        var (grace, partner) = await PartnerAsync();

        var response = await factory.ClientFor(grace, Role.CityLead).GetAsync($"/api/partners/{partner.Id}/activities{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task More_than_50_entries_page_by_50_without_repeats_or_gaps()
    {
        var (grace, partner) = await PartnerAsync();
        var day = DateOnly.FromDateTime(Now).AddDays(-1);
        // 120 notes, many on the same date and time, so paging must use the log time and id too.
        await SeedAsync(partner.Id, grace.ProfileId,
            [.. Enumerable.Range(0, 120).Select(i => ($"note {i}", day.AddDays(-(i / 40)), i % 3 == 0 ? (TimeOnly?)null : new TimeOnly(10, 0), i % 2))]);
        var client = factory.ClientFor(grace, Role.CityLead);

        var first = await client.ActivitiesAsync(partner.Id, "?kind=Note");
        var second = await client.ActivitiesAsync(partner.Id, $"?kind=Note&before={first.Before}");
        var third = await client.ActivitiesAsync(partner.Id, $"?kind=Note&before={second.Before}");

        Assert.Equal((50, 50, 20), (first.Items.Length, second.Items.Length, third.Items.Length));
        Assert.Null(third.Before);
        var all = first.Items.Concat(second.Items).Concat(third.Items).ToList();
        Assert.Equal(120, all.Select(a => a.Id).Distinct().Count());
        var everything = await factory.WithDbAsync(db => Task.FromResult(
            PartnerTimelineOrderForTests(db.PartnerActivities.Where(a => a.PartnerId == partner.Id && a.Kind == PartnerActivityKind.Note))));
        Assert.Equal(everything, all.Select(a => a.Id));
    }

    [Fact]
    public async Task The_partner_and_its_card_show_the_latest_next_step_and_the_last_activity()
    {
        var (grace, partner) = await PartnerAsync();
        var client = factory.ClientFor(grace, Role.CityLead);
        var today = DateOnly.FromDateTime(Now);
        Assert.Equal((today, (string?)null), ((await client.GetFromJsonAsync<Partner>($"/api/partners/{partner.Id}"))!.LastActivityOn, (await client.GetFromJsonAsync<Partner>($"/api/partners/{partner.Id}"))!.NextStep));

        await client.LogActivityAsync(partner.Id, NewActivity("Call", occurredOn: today.AddDays(-5).ToString("yyyy-MM-dd"), nextStep: "Old step"));
        await client.LogActivityAsync(partner.Id, NewActivity("Meeting", occurredOn: today.AddDays(-2).ToString("yyyy-MM-dd"), nextStep: "Send credit-line wording", nextStepDue: today.AddDays(1).ToString("yyyy-MM-dd")));
        await client.LogActivityAsync(partner.Id, NewActivity("Note", occurredOn: today.AddDays(-1).ToString("yyyy-MM-dd")));

        var read = (await client.GetFromJsonAsync<Partner>($"/api/partners/{partner.Id}"))!;
        Assert.Equal(("Send credit-line wording", (DateOnly?)today.AddDays(1), (DateOnly?)today, true), (read.NextStep, read.NextStepDue, read.LastActivityOn, read.CanLogActivity));
        var card = (await client.GetFromJsonAsync<Board>("/api/partners"))!.Columns.SelectMany(c => c.Cards).Single(c => c.Id == partner.Id);
        Assert.Equal(("Send credit-line wording", (DateOnly?)today.AddDays(1)), (card.NextStep, card.NextStepDue));
    }

    [Fact]
    public async Task Staff_see_that_they_cannot_log_activity()
    {
        var (grace, partner) = await PartnerAsync();

        var read = (await factory.ClientFor(await factory.AddMemberAsync("Daniel Reyes"), Role.Staff).GetFromJsonAsync<Partner>($"/api/partners/{partner.Id}"))!;

        Assert.False(read.CanLogActivity);
    }

    private async Task<(ProfileClients.Member Grace, Partner Partner)> PartnerAsync()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        return (grace, await factory.CreatePartnerAsync(grace, $"Kestrel Labs {Guid.NewGuid():N}"));
    }

    /// <summary>Notes logged straight into the database, each a few seconds after the last plus its offset.</summary>
    private Task SeedAsync(Guid partnerId, Guid by, params (string Summary, DateOnly On, TimeOnly? At, int LoggedLater)[] notes) =>
        factory.WithDbAsync(async db =>
        {
            var at = Now.AddDays(-10);
            foreach (var (summary, on, time, later) in notes)
            {
                db.PartnerActivities.Add(PartnerActivity.Log(partnerId, PartnerActivityKind.Note, summary, on, time, null, null, by, at.AddMinutes(later)));
            }

            return await db.SaveChangesAsync();
        });

    private static List<Guid> PartnerTimelineOrderForTests(IQueryable<PartnerActivity> rows) =>
        [.. rows.AsEnumerable()
            .OrderByDescending(a => a.OccurredOn)
            .ThenByDescending(a => a.OccurredAt ?? TimeOnly.MinValue)
            .ThenByDescending(a => a.LoggedAtUtc)
            .ThenByDescending(a => a.Id)
            .Select(a => a.Id)];
}
