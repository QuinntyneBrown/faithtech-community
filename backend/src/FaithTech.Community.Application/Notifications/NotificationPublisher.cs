using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notifications;

/// <summary>A notification's email: subject and plain-text body, plus an optional per-recipient footer.</summary>
public record NotificationEmail(string Subject, string Text, Func<Guid, string>? Footer = null);

/// <summary>The one way features raise notifications: in-app always, email when given (L2-027, L2-028, ADR 0009).</summary>
public interface INotificationPublisher
{
    /// <summary>Saves one notification per recipient profile, then queues each recipient's email.</summary>
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
        foreach (var recipient in recipients)
        {
            db.Notifications.Add(new Notification(recipient, kind, title, linkPath, now, actorName));
        }

        await db.SaveChangesAsync(cancellationToken);
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
            var body = email.Footer is null ? email.Text : $"{email.Text}\n\n{email.Footer(recipient.ProfileId)}";
            await emails.SendAsync(new EmailMessage(recipient.Email!, email.Subject, body), cancellationToken);
        }
    }
}
