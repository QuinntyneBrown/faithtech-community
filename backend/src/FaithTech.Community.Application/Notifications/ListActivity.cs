using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notifications;

/// <summary>
/// One line of home's Recent activity: what happened, where it links and when, and the member who acted, for the
/// avatar: their name and featured photo, all null when no member acted.
/// </summary>
public record ActivityItemDto(
    Guid Id,
    string Kind,
    string Text,
    string LinkPath,
    DateTimeOffset OccurredAt,
    Guid? ActorId = null,
    string? ActorName = null,
    string? ActorPhotoUrl = null);

/// <summary>
/// Home's recent-activity feed (L2-049 AC1, AC7; ADR 0016): the newest notifications addressed to the caller.
/// Every notification goes to one member, so the feed never shows another member's data, such as a private
/// contact's sign-up, whatever the caller's roles.
/// </summary>
public class ListActivityHandler(IApplicationDbContext db, ICurrentUser current, IPhotoStorage storage)
{
    public const int Limit = 10;

    /// <summary>The feed, or null when the caller has no profile.</summary>
    public async Task<IReadOnlyList<ActivityItemDto>?> HandleAsync(CancellationToken cancellationToken = default)
    {
        var me = current.ProfileId;
        if (me is null)
        {
            return null;
        }

        var rows = await (
                from n in db.Notifications.AsNoTracking()
                join actor in db.Profiles.AsNoTracking() on n.ActorId equals actor.Id into actors
                from actor in actors.DefaultIfEmpty()
                where n.RecipientId == me
                orderby n.CreatedAt descending
                select new
                {
                    n.Id,
                    n.Kind,
                    n.Title,
                    n.LinkPath,
                    n.CreatedAt,
                    ActorId = actor == null ? (Guid?)null : actor.Id,
                    ActorName = actor == null ? null : actor.Name,
                    Featured = actor == null
                        ? null
                        : actor.Photos.Where(p => p.IsFeatured).Select(p => p.BlobName).FirstOrDefault(),
                })
            .Take(Limit)
            .ToListAsync(cancellationToken);
        return rows
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new ActivityItemDto(
                n.Id,
                n.Kind.ToString(),
                n.Title,
                n.LinkPath,
                n.CreatedAt,
                n.ActorId,
                n.ActorName,
                n.Featured is null ? null : storage.GetReadUrl(n.Featured)))
            .ToList();
    }
}
