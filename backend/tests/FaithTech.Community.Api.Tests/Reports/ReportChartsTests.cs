// Traces to: L2-126, L2-127 AC2 (docs/detailed-designs/reports/reports-dashboard, ADR 0030)
using FaithTech.Community.Domain.Partners;
using static FaithTech.Community.Api.Tests.Reports.ReportClients;

namespace FaithTech.Community.Api.Tests.Reports;

public class ReportChartsTests : IAsyncLifetime
{
    private CommunityApiFactory factory = null!;

    public async Task InitializeAsync() => factory = await NewFactoryAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    private async Task AddMembersAsync(string? city, int count)
    {
        for (var i = 0; i < count; i++)
        {
            await factory.AddCityMemberAsync($"Member {city} {i}", city);
        }
    }

    // L2-126 AC1: Given All cities, then Members by city shows the four cities with most members (ties by name) and
    // every other city plus blank home cities as "Other"; given one city, that city alone.
    [Fact]
    public async Task Members_by_city_shows_the_top_four_cities_and_Other()
    {
        var staff = await factory.StaffAsync();
        await AddMembersAsync("Toronto", 5);
        await AddMembersAsync("Vancouver", 3);
        await AddMembersAsync("Calgary", 3);
        await AddMembersAsync("Austin", 2);
        await AddMembersAsync("Halifax", 1);
        await AddMembersAsync(" ", 1);

        var all = await staff.ReportAsync();
        var toronto = await staff.ReportAsync("?city=Toronto");

        Assert.Equal(
            [new("Toronto", 5), new("Calgary", 3), new("Vancouver", 3), new("Austin", 2), new ChartRow("Other", 3)],
            all.MembersByCity);
        Assert.Equal([new ChartRow("Toronto", 5)], toronto.MembersByCity);
    }

    [Fact]
    public async Task Other_is_left_out_when_every_member_is_in_the_top_four()
    {
        var staff = await factory.StaffAsync();
        await factory.WithDbAsync(async db =>
        {
            var me = db.Profiles.Single();
            me.Update(me.Name, "Toronto", null);
            return await db.SaveChangesAsync();
        });

        Assert.Equal([new ChartRow("Toronto", 1)], (await staff.ReportAsync()).MembersByCity);
    }

    // L2-126 AC2: New members by month shows each UTC calendar month the period touches, at most the last 12,
    // empty months as 0 and the current month "so far"; only joins in the window count.
    [Fact]
    public async Task New_members_by_month_shows_the_months_of_the_period()
    {
        var staff = await factory.StaffAsync();
        await factory.AddCityMemberAsync("Before the window", "Toronto", joinedAt: new DateTimeOffset(2031, 2, 10, 0, 0, 0, TimeSpan.Zero));
        await factory.AddCityMemberAsync("Feb", "Toronto", joinedAt: new DateTimeOffset(2031, 2, 20, 0, 0, 0, TimeSpan.Zero));
        await factory.AddCityMemberAsync("Mar 1", "Vancouver", joinedAt: new DateTimeOffset(2031, 3, 1, 0, 0, 0, TimeSpan.Zero));
        await factory.AddCityMemberAsync("Mar 14", "Toronto", joinedAt: new DateTimeOffset(2031, 3, 14, 23, 0, 0, TimeSpan.Zero));
        await factory.AddCityMemberAsync("Long ago", "Toronto", joinedAt: new DateTimeOffset(2029, 1, 5, 0, 0, 0, TimeSpan.Zero));

        var thirty = await staff.ReportAsync();
        var ninety = await staff.ReportAsync("?period=last-90-days&city=Toronto");
        var allTime = await staff.ReportAsync("?period=all-time");

        Assert.Equal([new("2031-02", "Feb", 1, false), new MonthRow("2031-03", "Mar", 2, true)], thirty.NewMembersByMonth);
        Assert.Equal(
            [new("2030-12", "Dec 2030", 0, false), new("2031-01", "Jan 2031", 0, false), new("2031-02", "Feb 2031", 2, false), new MonthRow("2031-03", "Mar 2031", 1, true)],
            ninety.NewMembersByMonth);
        Assert.Equal(12, allTime.NewMembersByMonth.Length);
        Assert.Equal("2030-04", allTime.NewMembersByMonth[0].Month);
        Assert.Equal(new MonthRow("2031-03", "Mar 2031", 2, true), allTime.NewMembersByMonth[^1]);
    }

    // L2-126 AC4: Partner pipeline by city lists Lead, In funnel and Confirmed per partner city, alphabetical with
    // every city in the list, then "No city" when it has partners; under one city, that city's row.
    [Fact]
    public async Task Partner_pipeline_by_city_counts_each_stage_by_owner_city()
    {
        var staff = await factory.StaffAsync();
        var grace = await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto");
        var ruth = await factory.AddCityMemberAsync("Ruth Alvarez", "Austin");
        await factory.AddCityMemberAsync("Mira Chen", "Vancouver");
        await factory.AddReportPartnerAsync("Kestrel Labs", grace.ProfileId, PartnerStage.Confirmed);
        await factory.AddReportPartnerAsync("Maple Church", grace.ProfileId, PartnerStage.Lead);
        await factory.AddReportPartnerAsync("Maple Church Too", grace.ProfileId, PartnerStage.Lead);
        await factory.AddReportPartnerAsync("Lone Star", ruth.ProfileId, PartnerStage.InFunnel);
        await factory.AddReportPartnerAsync("Orphan Co", null, PartnerStage.InFunnel);

        var all = await staff.ReportAsync();
        var toronto = await staff.ReportAsync("?city=Toronto");
        var vancouver = await staff.ReportAsync("?city=Vancouver");

        Assert.Equal(
            [new("Austin", 0, 1, 0), new("Toronto", 2, 0, 1), new("Vancouver", 0, 0, 0), new PipelineRow("No city", 0, 1, 0)],
            all.PartnerPipeline);
        Assert.Equal([new PipelineRow("Toronto", 2, 0, 1)], toronto.PartnerPipeline);
        Assert.Equal([new PipelineRow("Vancouver", 0, 0, 0)], vancouver.PartnerPipeline);
    }

    // L2-126 AC5: Events and attendance lists events starting in the period and in the next 30 days, newest first,
    // at most 50, with going and checked in (walk-ins excluded) and the rate, or Upcoming or Cancelled.
    [Fact]
    public async Task Events_and_attendance_lists_the_period_and_the_next_30_days_newest_first()
    {
        var staff = await factory.StaffAsync();
        var held = await factory.AddReportEventAsync("Builders Night", Now.AddDays(-7), "Toronto", rsvps: 8, checkedIn: 7, walkIns: 3);
        var quiet = await factory.AddReportEventAsync("Quiet night", Now.AddDays(-2), "Vancouver");
        var off = await factory.AddReportEventAsync("Called off", Now.AddDays(-5), "Toronto", rsvps: 4, cancelled: true);
        var soon = await factory.AddReportEventAsync("Next month", Now.AddDays(30), "Toronto", rsvps: 3);
        await factory.AddReportEventAsync("Too far", Now.AddDays(31), "Toronto");
        await factory.AddReportEventAsync("Too old", Now.AddDays(-31), "Toronto");

        var report = await staff.ReportAsync();
        var toronto = await staff.ReportAsync("?city=Toronto");

        Assert.Equal(
            [
                new(soon.Id, "Next month", soon.StartsAt, "Toronto", "Upcoming", 3, null, null),
                new(quiet.Id, "Quiet night", quiet.StartsAt, "Vancouver", "Held", 0, 0, null),
                new(off.Id, "Called off", off.StartsAt, "Toronto", "Cancelled", null, null, null),
                new EventRow(held.Id, "Builders Night", held.StartsAt, "Toronto", "Held", 8, 7, 88),
            ],
            report.Events);
        Assert.Equal([soon.Id, off.Id, held.Id], toronto.Events.Select(e => e.Id));
    }

    [Fact]
    public async Task Events_and_attendance_holds_at_most_50_events()
    {
        var staff = await factory.StaffAsync();
        for (var i = 0; i < 55; i++)
        {
            await factory.AddReportEventAsync($"Night {i}", Now.AddDays(-i * 0.5), "Toronto");
        }

        var report = await staff.ReportAsync();

        Assert.Equal(50, report.Events.Length);
        Assert.Equal("Night 0", report.Events[0].Title);
    }

    // L2-127 AC2: Given no members and no events for the filters, then the report is empty.
    [Fact]
    public async Task A_city_with_no_members_and_no_events_in_range_is_empty()
    {
        var staff = await factory.StaffAsync();
        await factory.AddReportEventAsync("Long ago", Now.AddDays(-400), "Calgary");

        Assert.True((await staff.ReportAsync("?city=Calgary")).IsEmpty);
        Assert.False((await staff.ReportAsync()).IsEmpty);
    }
}
