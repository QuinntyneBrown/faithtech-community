using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Notifications;

/// <summary>The email form of a notification. The link to the related item is appended to the body.</summary>
public record NotificationEmail(string Subject, string Body);

/// <summary>
/// The one way new features raise notifications (L2-027, L2-028): an in-app notification per recipient and,
/// when the source has an email form, a queued email. Both join the caller's unit of work; the caller saves.
/// </summary>
public interface INotificationPublisher
{
    /// <summary>Returns how many emails were queued.</summary>
    Task<int> PublishAsync(
        IReadOnlyCollection<Guid> recipientIds,
        NotificationKind kind,
        string title,
        string linkPath,
        Guid? actorId,
        Func<Guid, NotificationEmail?>? email,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Only announcement emails can be turned off: a recipient with <c>AnnouncementEmailsOptedOut</c> still gets the
/// in-app notification and every other kind of email (L2-028 AC3).
/// </summary>
public class NotificationPublisher(IApplicationDbContext db, IEmailQueue emails, IOptions<WebAppOptions> webApp, TimeProvider time)
    : INotificationPublisher
{
    public async Task<int> PublishAsync(
        IReadOnlyCollection<Guid> recipientIds,
        NotificationKind kind,
        string title,
        string linkPath,
        Guid? actorId,
        Func<Guid, NotificationEmail?>? email,
        CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var recipients = recipientIds.Distinct().ToList();
        foreach (var recipient in recipients)
        {
            db.Notifications.Add(new Notification(recipient, kind, title, linkPath, now, actorId));
        }

        if (email is null || recipients.Count == 0)
        {
            return 0;
        }

        var addresses = await (
                from user in db.Users
                join profile in db.Profiles on user.ProfileId equals profile.Id
                where recipients.Contains(user.ProfileId) && user.Email != null
                where kind != NotificationKind.Announcement || !profile.AnnouncementEmailsOptedOut
                select new { user.ProfileId, user.Email })
            .ToListAsync(cancellationToken);

        var queued = 0;
        foreach (var address in addresses)
        {
            if (email(address.ProfileId) is { } message)
            {
                emails.Enqueue(new EmailMessage(address.Email!, message.Subject, $"{message.Body}\n\n{webApp.Value.Origin}{linkPath}"));
                queued++;
            }
        }

        return queued;
    }
}
