using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Common;

/// <summary>
/// Temporary adapter, removed in slice 11 (docs/prompts/11): access classes still decide by the former <see cref="Role"/>
/// values, and each seeded role definition's key is the former value of the same name (L2-151 AC4).
/// </summary>
public static class LegacyRoles
{
    public static string Key(Role role) => role.ToString();

    public static List<string> Keys(IEnumerable<Role> roles) => [.. roles.Select(Key)];

    /// <summary>The current organisation's non-archived definitions whose keys are <paramref name="roles"/>, tracked.</summary>
    public static async Task<List<RoleDefinition>> DefinitionsAsync(IApplicationDbContext db, IEnumerable<Role> roles, CancellationToken cancellationToken)
    {
        var keys = Keys(roles.Distinct());
        return await db.RoleDefinitions
            .Where(d => d.ArchivedAtUtc == null && keys.Contains(d.Key))
            .OrderBy(d => d.SortOrder)
            .ToListAsync(cancellationToken);
    }

    /// <summary>The former values among <paramref name="keys"/>, in role order; a key no former value names is skipped.</summary>
    public static List<Role> Parse(IEnumerable<string> keys) =>
        [.. keys.Select(k => Enum.TryParse<Role>(k, ignoreCase: false, out var role) && Enum.IsDefined(role) ? (Role?)role : null).OfType<Role>().Order()];
}
