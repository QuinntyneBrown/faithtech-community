using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Infrastructure.Organisations;

/// <summary>Reads the organisation over the unique host and slug indexes. Hosts are stored in lower case.</summary>
public class OrganisationResolver(CommunityDbContext db) : IOrganisationResolver
{
    public Task<Organisation?> ResolveByHostAsync(string host, CancellationToken cancellationToken = default)
    {
        var lower = host.Trim().ToLowerInvariant();
        return db.Organisations.AsNoTracking().SingleOrDefaultAsync(o => o.Host == lower, cancellationToken);
    }

    public Task<Organisation?> ResolveBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        db.Organisations.AsNoTracking().SingleOrDefaultAsync(o => o.Slug == slug, cancellationToken);
}
