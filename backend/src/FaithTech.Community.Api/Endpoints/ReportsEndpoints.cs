using FaithTech.Community.Application.Reports;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Reports (L2-098 to L2-104) for Staff and System Admins. Requires authentication.</summary>
public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder app)
    {
        var reports = app.MapGroup("/api/reports");

        reports.MapGet("/", async (string? city, string? period, GetReportHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, report) = await handler.HandleAsync(new GetReportQuery(city, period), cancellationToken);
            return result.ToHttp(() => Results.Ok(report));
        });

        return app;
    }
}
