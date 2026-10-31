using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

/// <summary>
/// Maps a resource type key onto the organisation's list (L2-146 AC2, AC3): <see cref="ResolveGuessAsync"/> answers the
/// active type with a guessed key, or the type keyed <c>other</c> when that key is missing or archived;
/// <see cref="ChosenAsync"/> answers the active type a member chose, or the resource's current type even if archived.
/// </summary>
public class ResourceTypeResolver(IApplicationDbContext db)
{
    public async Task<ResourceType> ResolveGuessAsync(string key, CancellationToken cancellationToken = default) =>
        await db.ResourceTypes.FirstOrDefaultAsync(t => t.Key == key && t.ArchivedAtUtc == null, cancellationToken)
        ?? await db.ResourceTypes.FirstAsync(t => t.Key == ResourceType.OtherKey, cancellationToken);

    public Task<ResourceType?> ChosenAsync(string? key, Guid? current, CancellationToken cancellationToken = default) =>
        db.ResourceTypes.FirstOrDefaultAsync(t => t.Key == key && (t.ArchivedAtUtc == null || t.Id == current), cancellationToken);
}
