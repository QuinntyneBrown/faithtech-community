using System.Text;
using FaithTech.Community.Application.Admin;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The read-only audit log (L2-041). There is deliberately no route that edits or deletes an entry.</summary>
public static class AuditLogEndpoints
{
    public static IEndpointRouteBuilder MapAuditLogEndpoints(this IEndpointRouteBuilder app)
    {
        var audit = app.MapGroup("/api/admin/audit");

        audit.MapGet("", async ([AsParameters] AuditFilters filters, GetAuditEntriesHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(filters.ToQuery(), cancellationToken) is { } page ? Results.Ok(page) : Results.Forbid());

        audit.MapGet("/export", async ([AsParameters] AuditFilters filters, GetAuditEntriesHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAllAsync(filters.ToQuery(), cancellationToken) is { } entries
                ? Results.File(Encoding.UTF8.GetBytes(ToCsv(entries)), "text/csv", "audit-log.csv")
                : Results.Forbid());

        return app;
    }

    private static string ToCsv(IEnumerable<AuditEntryDto> entries)
    {
        var csv = new StringBuilder("When (UTC),Who,Action,Summary,Target type,Target id,IP address\n");
        foreach (var e in entries)
        {
            csv.AppendJoin(',', [e.OccurredAtUtc.ToString("yyyy-MM-dd HH:mm:ss"), Cell(e.ActorName), e.Action, Cell(e.Summary), e.TargetType, e.TargetId, e.IpAddress]).Append('\n');
        }

        return csv.ToString();
    }

    // Quotes cells with separators and neutralises leading formula characters for spreadsheet safety.
    private static string Cell(string value)
    {
        var safe = value.Length > 0 && "=+-@".Contains(value[0]) ? $"'{value}" : value;
        return safe.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? $"\"{safe.Replace("\"", "\"\"")}\"" : safe;
    }

    public record AuditFilters(string? Category, Guid? Actor, DateTime? From, DateTime? To, int? Page)
    {
        public GetAuditEntriesQuery ToQuery() => new(Category, Actor, Utc(From), Utc(To), Page ?? 1);

        // Dates without an offset are read as UTC, the log's own time zone.
        private static DateTime? Utc(DateTime? value) =>
            value is { } v ? (v.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(v, DateTimeKind.Utc) : v.ToUniversalTime()) : null;
    }
}
