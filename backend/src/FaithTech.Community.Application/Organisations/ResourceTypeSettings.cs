using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Organisations;

/// <summary>
/// A resource type as Stages &amp; types lists it (L2-146 AC1): its key, name, order, whether and when it was archived, how
/// many resources are of it, and whether it may be archived (never the type keyed <c>other</c>).
/// </summary>
public sealed record ResourceTypeDto(
    Guid Id, string Key, string Name, int SortOrder, bool Archived, DateTime? ArchivedAtUtc, int ResourceCount, bool CanArchive);

/// <summary>An active resource type as the resource dialogs and the Resources type filter offer it, from GET /api/organisation.</summary>
public sealed record ResourceTypeOptionDto(Guid Id, string Key, string Name);

/// <summary>
/// The organisation's resource types on Stages &amp; types (L2-146 AC1, AC2, AC4): listed for a holder of
/// ManageOrganisationSettings, or read-only with ManageRoles (L2-147); added, renamed, reordered and archived by a holder of
/// ManageOrganisationSettings, each audited as taxonomy.updated in the same unit of work (L2-152 AC1). A type with
/// resources may be archived: the resources keep it. The type keyed <c>other</c> stays, as the guess falls back to it.
/// </summary>
public class ManageResourceTypesHandler(IApplicationDbContext db, ICurrentUser current, IAuditLog audit, TimeProvider time)
{
    public const string List = "resource-types";

    public async Task<(Result Result, IReadOnlyList<ResourceTypeDto>? Types)> ListAsync(bool archived, CancellationToken cancellationToken = default)
    {
        if (!current.Has(Capability.ManageOrganisationSettings) && !current.Has(Capability.ManageRoles))
        {
            return (Result.Forbidden(), null);
        }

        var types = await db.ResourceTypes.Where(t => (t.ArchivedAtUtc != null) == archived)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name).ToListAsync(cancellationToken);
        var counts = await CountsAsync(cancellationToken);
        return (Result.Ok(), [.. types.Select(t => Dto(t, counts))]);
    }

    public async Task<(Result Result, ResourceTypeDto? Type)> AddAsync(TaxonomyNameCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var name = command.Name!.Trim();
        if (await TakenAsync(name, null, cancellationToken) is { } taken)
        {
            return (taken, null);
        }

        var types = await db.ResourceTypes.ToListAsync(cancellationToken);
        var last = types.Where(t => !t.IsArchived).Select(t => (int?)t.SortOrder).Max();
        var type = new ResourceType(Guid.NewGuid(), TaxonomyRules.KeyFor(name, [.. types.Select(t => t.Key)]), name, (last ?? 0) + 1);
        db.ResourceTypes.Add(type);
        Audit(type.Id, null, Snapshot(type));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Dto(type, new Dictionary<Guid, int>()));
    }

    public async Task<(Result Result, ResourceTypeDto? Type)> RenameAsync(
        Guid id, TaxonomyNameCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        if (await db.ResourceTypes.SingleOrDefaultAsync(t => t.Id == id && t.ArchivedAtUtc == null, cancellationToken) is not { } type)
        {
            return (Result.NotFound(), null);
        }

        var name = command.Name!.Trim();
        if (await TakenAsync(name, id, cancellationToken) is { } taken)
        {
            return (taken, null);
        }

        var before = Snapshot(type);
        type.Rename(name);
        Audit(id, before, Snapshot(type));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Dto(type, await CountsAsync(cancellationToken)));
    }

    public async Task<(Result Result, IReadOnlyList<ResourceTypeDto>? Types)> ReorderAsync(
        ReorderTaxonomyCommand command, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var types = await db.ResourceTypes.Where(t => t.ArchivedAtUtc == null).ToListAsync(cancellationToken);
        var ids = command.Ids ?? [];
        if (ids.Length != types.Count || ids.Distinct().Count() != ids.Length || ids.Any(id => types.All(t => t.Id != id)))
        {
            return (Result.Invalid(nameof(ReorderTaxonomyCommand.Ids), "List every active type once."), null);
        }

        var before = types.OrderBy(t => t.SortOrder).Select(t => t.Key).ToList();
        for (var i = 0; i < ids.Length; i++)
        {
            types.Single(t => t.Id == ids[i]).MoveTo(i + 1);
        }

        var ordered = types.OrderBy(t => t.SortOrder).ToList();
        audit.Record(current.Membership!.ProfileId, "taxonomy.updated", "Taxonomy", List,
            new { List, Order = before }, new { List, Order = ordered.Select(t => t.Key) });
        await db.SaveChangesAsync(cancellationToken);
        var counts = await CountsAsync(cancellationToken);
        return (Result.Ok(), [.. ordered.Select(t => Dto(t, counts))]);
    }

    /// <summary>Archives an active type other than <c>other</c> (L2-146 AC1, AC4); its resources keep it.</summary>
    public async Task<(Result Result, ResourceTypeDto? Type)> ArchiveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (Refusal() is { } refused)
        {
            return (refused, null);
        }

        var types = await db.ResourceTypes.Where(t => t.ArchivedAtUtc == null).ToListAsync(cancellationToken);
        if (types.SingleOrDefault(t => t.Id == id) is not { } type)
        {
            return (Result.NotFound(), null);
        }

        if (!type.CanArchive)
        {
            return (Result.Conflict($"{type.Name} is where uploads go when their type can’t be guessed, so it can’t be archived."), null);
        }

        var before = Snapshot(type);
        type.Archive(time.GetUtcNow().UtcDateTime);
        Audit(id, before, Snapshot(type));
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), Dto(type, await CountsAsync(cancellationToken)));
    }

    private Result? Refusal() =>
        !current.Has(Capability.ManageOrganisationSettings) || current.Membership is null ? Result.Forbidden() : null;

    private async Task<Result?> TakenAsync(string name, Guid? except, CancellationToken cancellationToken)
    {
        var lower = name.ToLowerInvariant();
        var taken = await db.ResourceTypes.AnyAsync(
            t => t.ArchivedAtUtc == null && t.Id != except && t.Name.ToLower() == lower, cancellationToken);
        return taken ? Result.Invalid("Name", $"There’s already a type called {name}.") : null;
    }

    private Task<Dictionary<Guid, int>> CountsAsync(CancellationToken cancellationToken) =>
        db.Resources.Where(r => r.ArchivedAt == null).GroupBy(r => r.TypeId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, cancellationToken);

    private void Audit(Guid id, object? before, object after) =>
        audit.Record(current.Membership!.ProfileId, "taxonomy.updated", "ResourceType", id.ToString(), before, after);

    private static object Snapshot(ResourceType t) => new { List, t.Key, t.Name, t.SortOrder, Archived = t.IsArchived };

    private static ResourceTypeDto Dto(ResourceType t, IReadOnlyDictionary<Guid, int> counts) =>
        new(t.Id, t.Key, t.Name, t.SortOrder, t.IsArchived, t.ArchivedAtUtc, counts.GetValueOrDefault(t.Id), t.CanArchive);
}
