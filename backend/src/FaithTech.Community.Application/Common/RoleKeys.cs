using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Common;

/// <summary>
/// Resolves role keys from a request to the current organisation's role definitions (ADR 0033). The web app names roles
/// by key until it reads definitions (slice 12).
/// </summary>
public static class RoleKeys
{
    /// <summary>
    /// The non-archived definitions with <paramref name="keys"/>, tracked, in display order; null when a key names none.
    /// </summary>
    public static async Task<List<RoleDefinition>?> DefinitionsAsync(
        IApplicationDbContext db, IEnumerable<string?> keys, CancellationToken cancellationToken)
    {
        var wanted = keys.Distinct().ToList();
        if (wanted.Any(string.IsNullOrWhiteSpace))
        {
            return null;
        }

        var found = await db.RoleDefinitions
            .Where(d => d.ArchivedAtUtc == null && wanted.Contains(d.Key))
            .OrderBy(d => d.SortOrder)
            .ToListAsync(cancellationToken);
        return found.Count == wanted.Count ? found : null;
    }

    /// <summary>
    /// A role a resource or page can be shared with: any non-archived definition except one carrying
    /// AdministerOrganisation, whose holders read everything anyway (L2-061 AC1, L2-093).
    /// </summary>
    public static bool IsShareable(RoleDefinition definition) =>
        !definition.Capabilities.Contains(Capability.AdministerOrganisation);
}
