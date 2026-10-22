using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notifications;

/// <summary>
/// A notification's email: its subject and content, any attachments, and for announcements the per-recipient
/// unsubscribe path that the footer links to. The correlation id defaults to each recipient's notification id.
/// </summary>
public record NotificationEmail(
    string Subject,
    EmailContent Content,
    IReadOnlyList<EmailAttachment>? Attachments = null,
    Func<Guid, string>? UnsubscribePath = null,
    string? CorrelationId = null);

/// <summary>
/// The one way features raise notifications: in-app always, email when given (L2-027, L2-028, ADR 0015). Both are
/// added to the caller's unit of work, so the caller's SaveChanges commits them with the change they report.
/// </summary>
public interface INotificationPublisher
{
    /// <summary>Adds one notification per recipient profile and queues each recipient's email; the caller saves.</summary>
    Task PublishAsync(
        IReadOnlyCollection<Guid> recipientProfileIds,
        NotificationKind kind,
        string title,
        string linkPath,
        string? actorName = null,
        NotificationEmail? email = null,
        CancellationToken cancellationToken = default);
}

public class NotificationPublisher(IApplicationDbContext db, IEmailSender emails, TimeProvider time) : INotificationPublisher
{
    public async Task PublishAsync(
        IReadOnlyCollection<Guid> recipientProfileIds,
        NotificationKind kind,
        string title,
        string linkPath,
        string? actorName = null,
        NotificationEmail? email = null,
        CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var recipients = recipientProfileIds.Distinct().ToList();
        var added = new Dictionary<Guid, Notification>();
        foreach (var recipient in recipients)
        {
            added[recipient] = new Notification(recipient, kind, title, linkPath, now, actorName);
            db.Notifications.Add(added[recipient]);
        }

        if (email is null)
        {
            return;
        }

        // Only announcement emails can be turned off (L2-028 AC3).
        var announcement = kind == NotificationKind.Announcement;
        var addresses = await db.Users
            .Where(u => recipients.Contains(u.ProfileId) && u.Email != null)
            .Join(db.Profiles, u => u.ProfileId, p => p.Id, (u, p) => new { u.ProfileId, u.Email, p.AnnouncementEmailsOptedOut })
            .Where(r => !announcement || !r.AnnouncementEmailsOptedOut)
            .ToListAsync(cancellationToken);
        foreach (var recipient in addresses)
        {
            var content = email.UnsubscribePath is null
                ? email.Content
                : email.Content with { UnsubscribePath = email.UnsubscribePath(recipient.ProfileId) };
            await emails.SendAsync(
                new EmailMessage(
                    recipient.Email!, email.Subject, content, kind.ToString(), email.CorrelationId ?? added[recipient.ProfileId].Id.ToString(), email.Attachments),
                cancellationToken);
        }
    }
}
