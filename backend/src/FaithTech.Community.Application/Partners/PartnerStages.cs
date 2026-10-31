using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Partners;

/// <summary>The organisation's partner stages as the partner handlers read them (L2-144).</summary>
public static class PartnerStages
{
    /// <summary>The active stage with <paramref name="key"/>, or null for none, an unknown key or an archived stage.</summary>
    public static async Task<PartnerStage?> ActiveAsync(this IApplicationDbContext db, string? key, CancellationToken cancellationToken = default) =>
        string.IsNullOrWhiteSpace(key)
            ? null
            : await db.PartnerStages.FirstOrDefaultAsync(s => s.Key == key && s.ArchivedAtUtc == null, cancellationToken);

    /// <summary>The stage a new partner starts on: the one active initial stage (L2-144 AC3).</summary>
    public static Task<PartnerStage> InitialAsync(this IApplicationDbContext db, CancellationToken cancellationToken = default) =>
        db.PartnerStages.Where(s => s.ArchivedAtUtc == null)
            .OrderByDescending(s => s.IsInitial).ThenBy(s => s.SortOrder)
            .FirstAsync(cancellationToken);

    /// <summary>Every stage's key and the name history shows: the current name, with "(archived)" once archived (L2-144 AC6).</summary>
    public static async Task<StageNames> NamesAsync(this IApplicationDbContext db, CancellationToken cancellationToken = default)
    {
        var stages = await db.PartnerStages.AsNoTracking()
            .Select(s => new { s.Key, s.Name, s.ArchivedAtUtc, s.IsInitial })
            .ToListAsync(cancellationToken);
        return new StageNames(
            stages.ToDictionary(s => s.Key, s => s.ArchivedAtUtc is null ? s.Name : $"{s.Name} (archived)"),
            stages.FirstOrDefault(s => s.IsInitial && s.ArchivedAtUtc is null)?.Key);
    }
}

/// <summary>Stage keys to display names, and the key of the initial stage.</summary>
public sealed record StageNames(IReadOnlyDictionary<string, string> Names, string? InitialKey)
{
    /// <summary>The name for a key; a key the organisation no longer has shows as itself.</summary>
    public string Of(string key) => Names.TryGetValue(key, out var name) ? name : key;
}
