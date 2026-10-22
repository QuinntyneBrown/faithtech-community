using System.Globalization;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Events;

namespace FaithTech.Community.Application.Reports;

/// <summary>
/// The report as CSV (L2-128): the same access, filters and numbers as <see cref="GetReportHandler"/>, laid out one
/// section after another with a blank row between, through <see cref="ICsvWriter"/> (every cell quoted, formula
/// guard). The members context reads "18 new in the last 30 days", so no cell needs the guard to change it.
/// </summary>
public class ExportReportHandler(GetReportHandler reports, ICsvWriter csv, TimeProvider time)
{
    public async Task<(Result Result, CsvFile? File)> HandleAsync(GetReportQuery query, CancellationToken cancellationToken = default)
    {
        var (result, report) = await reports.HandleAsync(query, cancellationToken);
        if (report is null)
        {
            return (result, null);
        }

        var now = time.GetUtcNow();
        var period = Label(report.Period);
        var f = report.Figures;
        List<IReadOnlyList<string?>> rows =
        [
            ["Report", "FaithTech Community Reports"],
            ["City", report.City ?? "All cities"],
            ["Period", period],
            ["From (UTC)", report.From is { } from ? Utc(from) : null],
            ["To (UTC)", Utc(report.To)],
            ["Generated (UTC)", Utc(now)],
            [],
            ["Figures"],
            ["Figure", "Value", "Context"],
            ["Members", Text(f.Members.Value), f.Members.NewInPeriod is { } joined ? $"{joined} new in the {ReportPeriod.Describe(report.Period)}" : null],
            ["Events held", Text(f.EventsHeld.Value), $"{f.EventsHeld.Cancelled} cancelled"],
            ["RSVPs", Text(f.Rsvps.Value), f.Rsvps.CheckedInPercent is { } rate ? $"{rate}% checked in" : null],
            ["Partners confirmed", Text(f.PartnersConfirmed.Value), $"of {f.PartnersConfirmed.InPipeline} in the pipeline"],
            ["Announcements", Text(f.Announcements.Value), "sent by leads"],
            [],
            ["Members by city"],
            ["City", "Members"],
            .. report.MembersByCity.Select(r => (IReadOnlyList<string?>)[r.Label, Text(r.Value)]),
            [],
            ["New members by month"],
            ["Month", "New members"],
            .. report.NewMembersByMonth.Select(m => (IReadOnlyList<string?>)[m.SoFar ? $"{m.Label} (so far)" : m.Label, Text(m.Value)]),
            [],
            ["Partner pipeline by city"],
            ["City", "Lead", "In funnel", "Confirmed"],
            .. report.PartnerPipeline.Select(r => (IReadOnlyList<string?>)[r.City, Text(r.Lead), Text(r.InFunnel), Text(r.Confirmed)]),
            [],
            ["Events and attendance"],
            ["Event", "Date (UTC)", "City", "Status", "Going", "Checked in", "Checked in %"],
            .. report.Events.Select(e => (IReadOnlyList<string?>)
                [e.Title, Utc(e.StartsAt), e.City, e.Status, Text(e.Going), Text(e.CheckedIn), Text(e.CheckedInPercent)]),
        ];

        var city = report.City is { } name ? EventFileNames.Slug(name) : "all-cities";
        var fileName = $"faithtech-report-{city}-{report.Period}-{now.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}.csv";
        return (Result.Ok(), new CsvFile(fileName, csv.Write(rows)));
    }

    private static string Label(string period) => period switch
    {
        ReportPeriod.Last30Days => "Last 30 days",
        ReportPeriod.Last90Days => "Last 90 days",
        ReportPeriod.ThisYear => "This year",
        _ => "All time",
    };

    private static string? Text(int? value) => value?.ToString(CultureInfo.InvariantCulture);

    private static string Utc(DateTimeOffset at) => at.UtcDateTime.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
}
