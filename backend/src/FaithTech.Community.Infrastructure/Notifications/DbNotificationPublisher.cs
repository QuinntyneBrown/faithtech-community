using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Infrastructure.Persistence;

namespace FaithTech.Community.Infrastructure.Notifications;

/// <summary>Adds the notification to the current unit of work; the caller's SaveChanges stores it.</summary>
public class DbNotificationPublisher(CommunityDbContext db, TimeProvider time) : INotificationPublisher
{
    public void Publish(Guid recipientProfileId, NotificationKind kind, string title, string linkPath) =>
        db.Notifications.Add(new Notification(recipientProfileId, kind, title, linkPath, time.GetUtcNow()));
}
