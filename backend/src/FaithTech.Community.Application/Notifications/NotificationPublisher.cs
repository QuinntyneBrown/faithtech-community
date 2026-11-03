using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notifications;

/// <summary>
/// Only announcement emails can be turned off: a recipient with <c>AnnouncementEmailsOptedOut</c> still gets the
/// in-app notification and every other kind of email (L2-028 AC3).
/// </summary>
public class NotificationPublisher(IApplicationDbContext db, IEmailQueue emails, ICurrentOrganisation organisation, TimeProvider time)
    : INotificationPublisher
{
    public void Publish(
        Guid recipientProfileId, NotificationKind kind, string title, string linkPath, string? linkText = null, Guid? actorId = null) =>
        db.Notifications.Add(new Notification(recipientProfileId, kind, title, linkPath, time.GetUtcNow(), actorId, linkText));

    public async Task<int> PublishAsync(
        IReadOnlyCollection<Guid> recipientIds,
        NotificationKind kind,
        string title,
        string linkPath,
        Guid? actorId,
        Func<Guid, NotificationEmail?>? email,
        CancellationToken cancellationToken = default,
        string? linkText = null)
    {
        var now = time.GetUtcNow();
        var recipients = recipientIds.Distinct().ToList();
        foreach (var recipient in recipients)
        {
            db.Notifications.Add(new Notification(recipient, kind, title, linkPath, now, actorId, linkText));
        }

        if (email is null || recipients.Count == 0)
        {
            return 0;
        }

        var addresses = await (
                from user in db.Users
                join profile in db.Profiles on (Guid?)user.Id equals profile.UserId
                where recipients.Contains(profile.Id) && user.Email != null
                where kind != NotificationKind.Announcement || !profile.AnnouncementEmailsOptedOut
                select new { ProfileId = profile.Id, user.Email })
            .ToListAsync(cancellationToken);

        var queued = 0;
        foreach (var address in addresses)
        {
            if (email(address.ProfileId) is { } message)
            {
                emails.Enqueue(new EmailMessage(address.Email!, message.Subject, $"{message.Body}\n\n{organisation.Origin}{linkPath}"));
                queued++;
            }
        }

        return queued;
    }
}
