// Traces to: L2-124 (docs/detailed-designs/reports/reports-dashboard, ADR 0030)
using System.Net;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using FaithTech.Community.Api.Tests.Organisations;
using FaithTech.Community.Domain.Partners;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using static FaithTech.Community.Api.Tests.Reports.ReportClients;

namespace FaithTech.Community.Api.Tests.Reports;

public class ReportFiltersTests : IAsyncLifetime
{
    private CommunityApiFactory factory = null!;

    public async Task InitializeAsync() => factory = await NewFactoryAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    // L2-124 AC1: Given no filters, when the report opens, then it shows All cities and Last 30 days, a window from
    // 30 days ago to now.
    [Fact]
    public async Task No_filters_means_All_cities_and_the_last_30_days()
    {
        var report = await (await factory.StaffAsync()).ReportAsync();

        Assert.Null(report.Chapter);
        Assert.Equal("last-30-days", report.Period);
        Assert.Equal(Now.AddDays(-30), report.From);
        Assert.Equal(Now, report.To);
    }

    // ADR 0030 windows: From is now minus 30 or 90 days, 1 January of the current UTC year, or none for All time.
    [Theory]
    [InlineData("last-30-days", "2031-02-13T12:00:00Z")]
    [InlineData("last-90-days", "2030-12-15T12:00:00Z")]
    [InlineData("this-year", "2031-01-01T00:00:00Z")]
    [InlineData("all-time", null)]
    public async Task Each_period_resolves_its_window(string period, string? from)
    {
        var report = await (await factory.StaffAsync()).ReportAsync($"?period={period}");

        Assert.Equal(period, report.Period);
        Assert.Equal(from is null ? null : DateTimeOffset.Parse(from, System.Globalization.CultureInfo.InvariantCulture), report.From);
        Assert.Equal(Now, report.To);
    }

    // L2-124 AC2, L2-142 AC1: the chapter list is the organisation's active chapters in order, used or not.
    [Fact]
    public async Task The_chapter_list_holds_the_active_chapters_in_order()
    {
        var staff = await factory.StaffAsync();
        await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto");
        await factory.AddChapterAsync("Austin");
        await factory.AddChapterAsync("Halifax", archived: true);
        var toronto = await factory.ChapterIdAsync("Toronto");

        var report = await staff.ReportAsync($"?chapter={toronto}");

        Assert.Equal(["Toronto", "Austin"], report.Chapters.Select(c => c.Name));
        Assert.Equal(toronto, report.Chapter);
        Assert.Equal("Toronto", report.ChapterName);
    }

    // L2-142 AC3: with chapters off the chapter filter is ignored, there is no chapter list or breakdown by chapter,
    // the pipeline is one row and events name no chapter.
    [Fact]
    public async Task With_chapters_off_the_report_is_organisation_wide()
    {
        var staff = await factory.StaffAsync();
        var grace = await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto");
        await factory.AddReportPartnerAsync("Kestrel Labs", grace.ProfileId, PartnerStage.Confirmed);
        await factory.AddReportEventAsync("Builders Night", Now.AddDays(-2), "Toronto");
        var toronto = await factory.ChapterIdAsync("Toronto");
        await factory.WithDbAsync(async db =>
        {
            db.Organisations.Single(o => o.Id == FaithTechSeed.OrganisationId).SetChapterLabel(null, null);
            return await db.SaveChangesAsync();
        });

        var report = await staff.ReportAsync($"?chapter={toronto}");

        Assert.Null(report.Chapter);
        Assert.Empty(report.Chapters);
        Assert.Empty(report.MembersByChapter);
        Assert.Equal(2, report.Figures.Members.Value);
        Assert.Equal([new PipelineRow("Partner pipeline", 0, 0, 1)], report.PartnerPipeline);
        Assert.Null(Assert.Single(report.Events).Chapter);
    }

    // L2-124 AC5: Given an unknown city or period, then the server answers 400 naming the filter.
    [Theory]
    [InlineData("?period=last-week", "period")]
    [InlineData("?chapter=Toronto", "chapter")]
    [InlineData("?chapter=6f1c0e5e-0000-4000-8000-000000000001", "chapter")]
    [InlineData("?chapter={archived}", "chapter")]
    public async Task An_unknown_chapter_or_period_is_400(string query, string field)
    {
        var staff = await factory.StaffAsync();
        await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto");
        query = query.Replace("{archived}", (await factory.AddChapterAsync("Halifax", archived: true)).Id.ToString());

        var response = await staff.GetAsync($"/api/reports{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal([field], problem!.Errors.Keys);
    }

    [Fact]
    public async Task An_empty_city_and_period_are_the_defaults()
    {
        var report = await (await factory.StaffAsync()).ReportAsync("?chapter=&period=");

        Assert.Null(report.Chapter);
        Assert.Equal("last-30-days", report.Period);
    }
}
