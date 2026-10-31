using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// A profile's current roles and capabilities in the current organisation: the union of the capabilities of every
/// non-archived definition it holds (L2-135 AC2). The one way the set is computed.
/// </summary>
public class ProfileCapabilities(IApplicationDbContext db)
{
    public async Task<(IReadOnlyList<HeldRole> Roles, IReadOnlySet<string> Capabilities)> OfAsync(
        Guid profileId, CancellationToken cancellationToken = default)
    {
        var held = await db.Profiles.AsNoTracking()
            .Where(p => p.Id == profileId)
            .SelectMany(p => p.Roles.Select(r => r.Definition!))
            .Where(d => d.ArchivedAtUtc == null)
            .OrderBy(d => d.SortOrder)
            .Select(d => new { d.Id, d.Key, d.Name, d.IsOversight, d.Capabilities })
            .ToListAsync(cancellationToken);
        return (
            [.. held.Select(d => new HeldRole(d.Id, d.Key, d.Name, d.IsOversight))],
            held.SelectMany(d => d.Capabilities).ToHashSet(StringComparer.Ordinal));
    }
}
