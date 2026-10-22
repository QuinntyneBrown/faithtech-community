using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notifications;

/// <summary>A notification as its recipient sees it. The actor is the member whose action raised it, when known.</summary>
public record NotificationDto(
    Guid Id, string Kind, string Title, string LinkPath, DateTimeOffset CreatedAt, DateTimeOffset? ReadAt, Guid? ActorId, string? ActorName);

public record NotificationPage(
    IReadOnlyList<NotificationDto> Items, int Page, int PageSize, int TotalCount, int UnreadCount, bool HasMore);

/// <summary>
/// The caller's own notifications (L2-027): listed newest first, 50 at a time, and marked read. Every query is
/// scoped to the caller's profile, so nobody else, Staff and System Admin included, reads or changes them.
/// </summary>
public class InAppNotificationsHandler(IApplicationDbContext db, ICurrentUser current, TimeProvider time)
{
    public const int PageSize = 50;

    public async Task<NotificationPage> ListAsync(bool unreadOnly, int page, CancellationToken cancellationToken = default)
    {
        var request = new PageRequest(page, PageSize);
        var recipient = await CallerProfileIdAsync(cancellationToken);
        var mine = db.Notifications.AsNoTracking().Where(n => n.RecipientId == recipient);
        var unreadCount = await mine.CountAsync(n => n.ReadAt == null, cancellationToken);
        var listed = unreadOnly ? mine.Where(n => n.ReadAt == null) : mine;
        var total = unreadOnly ? unreadCount : await listed.CountAsync(cancellationToken);
        var rows = await (
                from n in listed.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id).Skip(request.Skip).Take(request.PageSize)
                join actor in db.Profiles.AsNoTracking() on n.ActorId equals actor.Id into actors
                from actor in actors.DefaultIfEmpty()
                select new { n, ActorName = actor == null ? null : actor.Name })
            .ToListAsync(cancellationToken);

        // The join may lose the order in some providers, so it is applied again in memory.
        var items = rows
            .OrderByDescending(r => r.n.CreatedAt).ThenByDescending(r => r.n.Id)
            .Select(r => new NotificationDto(
                r.n.Id, r.n.Kind.ToString(), r.n.Title, r.n.LinkPath, r.n.CreatedAt, r.n.ReadAt, r.n.ActorId, r.ActorName))
            .ToList();
        return new NotificationPage(items, request.Page, request.PageSize, total, unreadCount, request.Skip + items.Count < total);
    }

    public async Task<int> UnreadCountAsync(CancellationToken cancellationToken = default)
    {
        var recipient = await CallerProfileIdAsync(cancellationToken);
        return await db.Notifications.CountAsync(n => n.RecipientId == recipient && n.ReadAt == null, cancellationToken);
    }

    /// <summary>Marks one of the caller's notifications read; anyone else's id is not found.</summary>
    public async Task<Result> MarkReadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var recipient = await CallerProfileIdAsync(cancellationToken);
        var notification = await db.Notifications.SingleOrDefaultAsync(n => n.Id == id && n.RecipientId == recipient, cancellationToken);
        if (notification is null)
        {
            return Result.NotFound();
        }

        notification.MarkRead(time.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    public async Task MarkAllReadAsync(CancellationToken cancellationToken = default)
    {
        var recipient = await CallerProfileIdAsync(cancellationToken);
        var unread = await db.Notifications.Where(n => n.RecipientId == recipient && n.ReadAt == null).ToListAsync(cancellationToken);
        var now = time.GetUtcNow();
        foreach (var notification in unread)
        {
            notification.MarkRead(now);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Guid> CallerProfileIdAsync(CancellationToken cancellationToken) =>
        current.UserId is { } userId
            ? await db.Users.Where(u => u.Id == userId).Select(u => u.ProfileId).SingleOrDefaultAsync(cancellationToken)
            : Guid.Empty;
}
