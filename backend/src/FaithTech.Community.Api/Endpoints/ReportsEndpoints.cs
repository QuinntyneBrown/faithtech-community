using System.Text;
using FaithTech.Community.Application.Reports;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Reports (L2-123 to L2-129) for Staff and System Admins. Requires authentication.</summary>
public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder app)
    {
        var reports = app.MapGroup("/api/reports");

        reports.MapGet("/", async (string? chapter, string? period, GetReportHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, report) = await handler.HandleAsync(new GetReportQuery(chapter, period), cancellationToken);
            return result.ToHttp(() => Results.Ok(report));
        });

        // UTF-8 with a byte-order mark, so spreadsheet apps read accented names (L2-128).
        reports.MapGet("/export.csv", async (string? chapter, string? period, ExportReportHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, file) = await handler.HandleAsync(new GetReportQuery(chapter, period), cancellationToken);
            return result.ToHttp(() => Results.File(
                [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(file!.Content)], "text/csv; charset=utf-8", file.FileName));
        });

        return app;
    }
}
