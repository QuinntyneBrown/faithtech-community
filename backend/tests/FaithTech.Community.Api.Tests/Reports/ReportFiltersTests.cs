// Traces to: L2-099 (docs/detailed-designs/reports/reports-dashboard, ADR 0026)
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using static FaithTech.Community.Api.Tests.Reports.ReportClients;

namespace FaithTech.Community.Api.Tests.Reports;

public class ReportFiltersTests : IAsyncLifetime
{
    private CommunityApiFactory factory = null!;

    public async Task InitializeAsync() => factory = await NewFactoryAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    // L2-099 AC1: Given no filters, when the report opens, then it shows All cities and Last 30 days, a window from
    // 30 days ago to now.
    [Fact]
    public async Task No_filters_means_All_cities_and_the_last_30_days()
    {
        var report = await (await factory.StaffAsync()).ReportAsync();

        Assert.Null(report.City);
        Assert.Equal("last-30-days", report.Period);
        Assert.Equal(Now.AddDays(-30), report.From);
        Assert.Equal(Now, report.To);
    }

    // ADR 0026 windows: From is now minus 30 or 90 days, 1 January of the current UTC year, or none for All time.
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

    // L2-099 AC2: the city list is every city used by a verified member's profile or by an event, sorted.
    [Fact]
    public async Task The_city_list_holds_verified_member_cities_and_event_cities_sorted()
    {
        var staff = await factory.StaffAsync();
        await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto");
        await factory.AddCityMemberAsync("Ruth Alvarez", "austin");
        await factory.AddCityMemberAsync("Lee Park", "  ");
        await factory.AddCityMemberAsync("Unverified Una", "Halifax", verified: false);
        await factory.AddCityMemberAsync("Suspended Sid", "Regina", suspended: true);
        await factory.AddReportEventAsync("Calgary Builders Night", Now.AddDays(-400), "Calgary", cancelled: true);
        await factory.AddReportEventAsync("Toronto Builders Night", Now.AddDays(5), "Toronto");

        var report = await staff.ReportAsync("?city=Toronto");

        Assert.Equal(["austin", "Calgary", "Toronto"], report.Cities);
        Assert.Equal("Toronto", report.City);
    }

    // L2-099 AC5: Given an unknown city or period, then the server answers 400 naming the filter.
    [Theory]
    [InlineData("?period=last-week", "period")]
    [InlineData("?city=Atlantis", "city")]
    [InlineData("?city=toronto", "city")]
    public async Task An_unknown_city_or_period_is_400(string query, string field)
    {
        var staff = await factory.StaffAsync();
        await factory.AddCityMemberAsync("Grace Okonkwo", "Toronto");

        var response = await staff.GetAsync($"/api/reports{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal([field], problem!.Errors.Keys);
    }

    [Fact]
    public async Task An_empty_city_and_period_are_the_defaults()
    {
        var report = await (await factory.StaffAsync()).ReportAsync("?city=&period=");

        Assert.Null(report.City);
        Assert.Equal("last-30-days", report.Period);
    }
}
