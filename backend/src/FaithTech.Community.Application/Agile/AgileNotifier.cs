using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Agile;

/// <summary>
/// In-app notifications and emails for workspace additions, assignments and Planning Poker invites (L2-027, L2-028).
/// <see cref="Notify"/> adds the notification to the unit of work; call <see cref="QueueEmailsAsync"/> before the save that commits
/// the action, so the outbox rows are saved with it.
/// Nobody is notified about their own action (ADR 0011).
/// </summary>
public class AgileNotifier(IApplicationDbContext db, IEmailSender email, TimeProvider time)
{
    private readonly List<(Notification Notification, string Subject, EmailContent Content)> _emails = [];

    /// <summary>The email's action opens <paramref name="linkPath"/>, the same place as the in-app notification.</summary>
    public void Notify(
        Guid actor, Guid recipient, NotificationKind kind, string title, string linkPath, string subject, string heading, string body, string actionLabel)
    {
        if (recipient == actor)
        {
            return;
        }

        var notification = new Notification(recipient, kind, title, linkPath, time.GetUtcNow());
        db.Notifications.Add(notification);
        _emails.Add((notification, subject, new EmailContent(heading, [body], new EmailAction(actionLabel, linkPath))));
    }

    public async Task QueueEmailsAsync(CancellationToken cancellationToken = default)
    {
        var recipients = _emails.Select(e => e.Notification.RecipientId).Distinct().ToList();
        var addresses = await db.Users.Where(u => recipients.Contains(u.ProfileId))
            .ToDictionaryAsync(u => u.ProfileId, u => u.Email, cancellationToken);
        foreach (var (notification, subject, content) in _emails)
        {
            if (addresses.GetValueOrDefault(notification.RecipientId) is { } address)
            {
                await email.SendAsync(
                    new EmailMessage(address, subject, content, notification.Kind.ToString(), notification.Id.ToString()), cancellationToken);
            }
        }

        _emails.Clear();
    }

    public static string FirstName(string name) => name.Split(' ', 2)[0];
}
