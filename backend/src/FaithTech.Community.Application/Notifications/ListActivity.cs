using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notifications;

/// <summary>One line of home's Recent activity: what happened, where it links and when.</summary>
public record ActivityItemDto(Guid Id, string Kind, string Text, string LinkPath, DateTimeOffset OccurredAt);

/// <summary>
/// Home's recent-activity feed (L2-049 AC1, AC7; ADR 0016): the newest notifications addressed to the caller.
/// Every notification goes to one member, so the feed never shows another member's data, such as a private
/// contact's sign-up, whatever the caller's roles.
/// </summary>
public class ListActivityHandler(IApplicationDbContext db, ICurrentUser current)
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

        var rows = await db.Notifications.AsNoTracking()
            .Where(n => n.RecipientId == me)
            .OrderByDescending(n => n.CreatedAt)
            .Take(Limit)
            .Select(n => new { n.Id, n.Kind, n.Title, n.LinkPath, n.CreatedAt })
            .ToListAsync(cancellationToken);
        return rows.Select(n => new ActivityItemDto(n.Id, n.Kind.ToString(), n.Title, n.LinkPath, n.CreatedAt)).ToList();
    }
}
