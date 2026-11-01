using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations.Platform;

/// <summary>An organisation as an operator sees it: its own settings and nothing else (L2-148 AC3).</summary>
public record OrganisationSummaryDto(string Slug, string Host, string Name, string ShortName, string Status, int AdministratorCount);

/// <summary>
/// GET /api/platform/organisations/{slug}. The administrator count is the active, unsuspended profiles holding a
/// non-archived definition that carries AdministerOrganisation; the request's own organisation is never read.
/// </summary>
public class GetOrganisationSummaryHandler(IApplicationDbContext db)
{
    public async Task<OrganisationSummaryDto?> HandleAsync(string slug, CancellationToken cancellationToken = default)
    {
        var organisation = await db.Organisations.AsNoTracking().SingleOrDefaultAsync(o => o.Slug == slug, cancellationToken);
        if (organisation is null)
        {
            return null;
        }

        var administrators = await db.Profiles.IgnoreQueryFilters(QueryFilters.OrganisationOnly).AsNoTracking()
            .Where(p => p.OrganisationId == organisation.Id && !p.IsSuspended)
            .CountAsync(p => p.Roles.Any(r =>
                r.Definition!.ArchivedAtUtc == null && r.Definition.Capabilities.Contains(Capability.AdministerOrganisation)),
                cancellationToken);
        return new OrganisationSummaryDto(
            organisation.Slug, organisation.Host, organisation.Name, organisation.ShortName, organisation.Status.ToString(), administrators);
    }
}
