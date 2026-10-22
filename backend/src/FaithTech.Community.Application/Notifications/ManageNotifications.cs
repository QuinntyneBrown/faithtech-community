using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notifications;

public record NotificationDto(
    Guid Id, string Kind, string Title, string LinkPath, string? ActorName, DateTimeOffset CreatedAt, DateTimeOffset? ReadAt);

public record NotificationPageDto(IReadOnlyList<NotificationDto> Items, int UnreadCount, int Page, int PageSize, int TotalCount);

/// <summary>The caller's own notifications only: every query filters by recipient in the database (L2-027).</summary>
public class ManageNotificationsHandler(IApplicationDbContext db, ProfileAccess access, TimeProvider time)
{
    public const int PageSize = 50;

    /// <summary>A page of 50, newest first; <paramref name="unreadOnly"/> lists only the unread ones (L2-027 AC5, AC6).</summary>
    public async Task<NotificationPageDto> ListAsync(int page, bool unreadOnly = false, CancellationToken cancellationToken = default)
    {
        var request = new PageRequest(page, PageSize);
        var mine = await MineAsync(cancellationToken);
        var unread = await mine.CountAsync(n => n.ReadAt == null, cancellationToken);
        var listed = unreadOnly ? mine.Where(n => n.ReadAt == null) : mine;
        var total = await listed.CountAsync(cancellationToken);
        var items = await listed
            .OrderByDescending(n => n.CreatedAt)
            .Skip(request.Skip)
            .Take(request.PageSize)
            .Select(n => new NotificationDto(n.Id, n.Kind.ToString(), n.Title, n.LinkPath, n.ActorName, n.CreatedAt, n.ReadAt))
            .ToListAsync(cancellationToken);
        return new NotificationPageDto(items, unread, request.Page, request.PageSize, total);
    }

    public async Task<int> UnreadCountAsync(CancellationToken cancellationToken = default) =>
        await (await MineAsync(cancellationToken)).CountAsync(n => n.ReadAt == null, cancellationToken);

    /// <summary>Someone else's notification is reported as not found, so ids do not leak.</summary>
    public async Task<Result> MarkReadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerProfileIdAsync(cancellationToken);
        var notification = await db.Notifications.SingleOrDefaultAsync(n => n.Id == id && n.RecipientId == caller, cancellationToken);
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
        var now = time.GetUtcNow();
        var unread = await (await MineAsync(cancellationToken, tracked: true)).Where(n => n.ReadAt == null).ToListAsync(cancellationToken);
        foreach (var notification in unread)
        {
            notification.MarkRead(now);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<IQueryable<Domain.Notifications.Notification>> MineAsync(CancellationToken cancellationToken, bool tracked = false)
    {
        var caller = await access.CallerProfileIdAsync(cancellationToken);
        var notifications = tracked ? db.Notifications : db.Notifications.AsNoTracking();
        return notifications.Where(n => n.RecipientId == caller);
    }
}
