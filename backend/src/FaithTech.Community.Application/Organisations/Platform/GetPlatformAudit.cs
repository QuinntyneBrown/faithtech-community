using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations.Platform;

public record PlatformAuditEntryDto(
    Guid Id, DateTime OccurredAtUtc, string OperatorEmail, string Source, string Action, string? OrganisationSlug, string Target, string? Details);

/// <summary>GET /api/platform/audit and <c>org audit</c>: the operator actions, newest first (L2-148 AC4).</summary>
public class GetPlatformAuditHandler(IApplicationDbContext db)
{
    public const int DefaultPageSize = 50;

    public async Task<PagedResult<PlatformAuditEntryDto>> HandleAsync(int page = 1, int pageSize = DefaultPageSize, CancellationToken cancellationToken = default)
    {
        var request = new PageRequest(page, pageSize);
        var entries = db.PlatformAuditEntries.AsNoTracking();
        var total = await entries.CountAsync(cancellationToken);
        var items = await entries
            .OrderByDescending(e => e.OccurredAtUtc).ThenBy(e => e.Id)
            .Skip(request.Skip).Take(request.PageSize)
            .Select(e => new PlatformAuditEntryDto(
                e.Id, e.OccurredAtUtc, e.OperatorEmail, e.Source.ToString(), e.Action, e.OrganisationSlug, e.Target, e.DetailsJson))
            .ToListAsync(cancellationToken);
        return new PagedResult<PlatformAuditEntryDto>(items, request.Page, request.PageSize, total);
    }
}
