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
        // One entry per assignment, so a role held for two chapters is listed twice with each tag.
        var held = await db.Profiles.AsNoTracking()
            .Where(p => p.Id == profileId)
            .SelectMany(p => p.Roles)
            .Where(r => r.Definition!.ArchivedAtUtc == null)
            .OrderBy(r => r.Definition!.SortOrder)
            .Select(r => new { r.Definition!.Id, r.Definition.Key, r.Definition.Name, r.Definition.IsOversight, r.Definition.Capabilities, r.ChapterId })
            .ToListAsync(cancellationToken);
        return (
            [.. held.Select(d => new HeldRole(d.Id, d.Key, d.Name, d.IsOversight, d.ChapterId))],
            held.SelectMany(d => d.Capabilities).ToHashSet(StringComparer.Ordinal));
    }
}
