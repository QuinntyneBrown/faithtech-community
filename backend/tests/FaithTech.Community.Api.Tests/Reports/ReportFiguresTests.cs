// Traces to: L2-125 (docs/detailed-designs/reports/reports-dashboard, ADR 0030)
using FaithTech.Community.Domain.Partners;
using static FaithTech.Community.Api.Tests.Reports.ReportClients;

namespace FaithTech.Community.Api.Tests.Reports;

/// <summary>
/// One test per figure definition and exclusion. The Staff caller is a verified member with no home city, so it
/// counts once under All cities.
/// </summary>
public class ReportFiguresTests : IAsyncLifetime
{
    private CommunityApiFactory factory = null!;

    public async Task InitializeAsync() => factory = await NewFactoryAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    // L2-125 AC1, AC7: Given members, when Members is computed, then it counts verified, non-suspended profiles,
    // with the city filter on the home city; "+N" counts those whose join time is in the period, and a profile with
    // no recorded join time is never new.
    [Fact]
    public async Task Members_counts_verified_unsuspended_profiles_and_new_ones_by_join_time()
    {
        var staff = await factory.StaffAsync();
        await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto", joinedAt: Now.AddDays(-2));
        await factory.AddCityMemberAsync("Ruth Alvarez", "Toronto", joinedAt: Now.AddDays(-30));
        await factory.AddCityMemberAsync("Lee Park", "Toronto", joinedAt: Now.AddDays(-31));
        await factory.AddCityMemberAsync("Old Timer", "Toronto");
        await factory.AddCityMemberAsync("Mira Chen", "Vancouver", joinedAt: Now.AddDays(-1));
        await factory.AddCityMemberAsync("Unverified Una", "Toronto", joinedAt: Now.AddDays(-1), verified: false);
        await factory.AddCityMemberAsync("Suspended Sid", "Toronto", joinedAt: Now.AddDays(-1), suspended: true);

        var all = await staff.ReportAsync();
        var toronto = await staff.ReportAsync("?city=Toronto");
        var allTime = await staff.ReportAsync("?city=Toronto&period=all-time");

        Assert.Equal(new MembersFigure(6, 3), all.Figures.Members);
        Assert.Equal(new MembersFigure(4, 2), toronto.Figures.Members);
        Assert.Equal(new MembersFigure(4, null), allTime.Figures.Members);
    }

    // L2-125 AC2, AC7: Events held counts events not cancelled that started in the window, up to now, by event
    // city; "{n} cancelled" counts cancelled events due to start in the window.
    [Fact]
    public async Task Events_held_counts_uncancelled_events_started_in_the_window_and_the_cancelled_ones_apart()
    {
        var staff = await factory.StaffAsync();
        await factory.AddReportEventAsync("At the start of the window", Now.AddDays(-30), "Toronto");
        await factory.AddReportEventAsync("Last week", Now.AddDays(-7), "Toronto");
        await factory.AddReportEventAsync("Vancouver night", Now.AddDays(-3), "Vancouver");
        await factory.AddReportEventAsync("Before the window", Now.AddDays(-31), "Toronto");
        await factory.AddReportEventAsync("Tomorrow", Now.AddDays(1), "Toronto");
        await factory.AddReportEventAsync("Called off", Now.AddDays(-5), "Toronto", cancelled: true);

        var all = await staff.ReportAsync();
        var toronto = await staff.ReportAsync("?city=Toronto");

        Assert.Equal(new EventsHeldFigure(3, 1), all.Figures.EventsHeld);
        Assert.Equal(new EventsHeldFigure(2, 1), toronto.Figures.EventsHeld);
    }

    // L2-125 AC3: RSVPs counts RSVPs on the events held, walk-ins excluded; the rate is checked-in RSVPs over RSVPs,
    // rounded half away from zero, and is null when there are none.
    [Fact]
    public async Task Rsvps_count_the_events_held_without_walk_ins_and_the_checked_in_rate()
    {
        var staff = await factory.StaffAsync();
        await factory.AddReportEventAsync("Builders Night", Now.AddDays(-7), "Toronto", rsvps: 5, checkedIn: 3, walkIns: 2);
        await factory.AddReportEventAsync("Prayer breakfast", Now.AddDays(-3), "Toronto", rsvps: 3, checkedIn: 0);
        await factory.AddReportEventAsync("Called off", Now.AddDays(-5), "Toronto", rsvps: 9, cancelled: true);
        await factory.AddReportEventAsync("Next week", Now.AddDays(7), "Toronto", rsvps: 4);

        var report = await staff.ReportAsync();
        var toronto = await staff.ReportAsync("?city=Toronto&period=last-30-days");

        Assert.Equal(new RsvpsFigure(8, 3, 38), report.Figures.Rsvps);
        Assert.Equal(report.Figures.Rsvps, toronto.Figures.Rsvps);
    }

    [Fact]
    public async Task The_checked_in_rate_is_null_when_there_are_no_rsvps()
    {
        var staff = await factory.StaffAsync();
        await factory.AddReportEventAsync("Walk-ins only", Now.AddDays(-7), "Toronto", walkIns: 3);

        Assert.Equal(new RsvpsFigure(0, 0, null), (await staff.ReportAsync()).Figures.Rsvps);
    }

    // L2-125 AC4, AC7: Partners confirmed counts non-archived partners at Confirmed, "of {n} in the pipeline" all
    // non-archived; a partner's city is its owner's home city whatever the owner's account state; no owner or no
    // home city is "No city", counted only under All cities; the period does not apply.
    [Fact]
    public async Task Partners_count_by_owner_city_without_archived_partners_and_ignore_the_period()
    {
        var staff = await factory.StaffAsync();
        var grace = await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto");
        var suspended = await factory.AddCityMemberAsync("Suspended Sid", "Toronto", suspended: true);
        var homeless = await factory.AddCityMemberAsync("Lee Park", null);
        var kept = await factory.AddReportPartnerAsync("Kestrel Labs", grace.ProfileId, PartnerStage.Confirmed);
        await factory.AddReportPartnerAsync("Kestrel Labs Inc", grace.ProfileId, PartnerStage.Confirmed, mergedInto: kept.Id);
        await factory.AddReportPartnerAsync("Maple Church", suspended.ProfileId, PartnerStage.InFunnel);
        await factory.AddReportPartnerAsync("Orphan Co", null, PartnerStage.Confirmed);
        await factory.AddReportPartnerAsync("Nomad Studio", homeless.ProfileId);

        var all = await staff.ReportAsync("?period=last-30-days");
        var allTime = await staff.ReportAsync("?period=all-time");
        var toronto = await staff.ReportAsync("?city=Toronto");

        Assert.Equal(new PartnersFigure(2, 4), all.Figures.PartnersConfirmed);
        Assert.Equal(all.Figures.PartnersConfirmed, allTime.Figures.PartnersConfirmed);
        Assert.Equal(new PartnersFigure(1, 2), toronto.Figures.PartnersConfirmed);
    }

    // L2-125 AC5: Announcements counts those sent in the window, with the city filter on the author's home city.
    [Fact]
    public async Task Announcements_count_those_sent_in_the_window_by_author_city()
    {
        var staff = await factory.StaffAsync();
        var grace = await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto");
        var mira = await factory.AddCityMemberAsync("Mira Chen", "Vancouver");
        await factory.AddAnnouncementAsync(grace.ProfileId, Now.AddDays(-30));
        await factory.AddAnnouncementAsync(grace.ProfileId, Now);
        await factory.AddAnnouncementAsync(grace.ProfileId, Now.AddDays(-31));
        await factory.AddAnnouncementAsync(mira.ProfileId, Now.AddDays(-1));

        Assert.Equal(3, (await staff.ReportAsync()).Figures.Announcements.Value);
        Assert.Equal(2, (await staff.ReportAsync("?city=Toronto")).Figures.Announcements.Value);
        Assert.Equal(4, (await staff.ReportAsync("?period=all-time")).Figures.Announcements.Value);
    }

    // L2-125 AC6: Given private contacts and their notes, when the report runs, then they are never read or
    // counted: adding a lead's contacts in a city leaves every number unchanged and adds no contact data.
    [Fact]
    public async Task Private_contacts_never_change_the_report_or_appear_in_it()
    {
        var staff = await factory.StaffAsync();
        var grace = await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto", joinedAt: Now.AddDays(-2));
        await factory.AddReportEventAsync("Builders Night", Now.AddDays(-7), "Toronto", rsvps: 2, checkedIn: 1);
        var before = await (await staff.GetAsync("/api/reports?city=Toronto")).Content.ReadAsStringAsync();
        var beforeAll = await (await staff.GetAsync("/api/reports")).Content.ReadAsStringAsync();

        await factory.AddPrivateContactAsync(grace.ProfileId, "Hidden Harriet", "harriet@secret.example", "Toronto");
        await factory.AddPrivateContactAsync(grace.ProfileId, "Quiet Quentin", "quentin@secret.example", "Saskatoon");

        var after = await (await staff.GetAsync("/api/reports?city=Toronto")).Content.ReadAsStringAsync();
        var afterAll = await (await staff.GetAsync("/api/reports")).Content.ReadAsStringAsync();
        Assert.Equal(before, after);
        Assert.Equal(beforeAll, afterAll);
        foreach (var secret in new[] { "Harriet", "harriet@secret.example", "Quentin", "Saskatoon", "Kestrel Labs", "wants to host" })
        {
            Assert.DoesNotContain(secret, afterAll, StringComparison.OrdinalIgnoreCase);
        }
    }
}
