using FaithTech.Community.Domain.Notifications;

namespace FaithTech.Community.Application.Notifications;

/// <summary>
/// Records in-app notifications (L2-027). The notifications feature (bell, panel, preferences) is not built yet;
/// this is its seam. The Infrastructure implementation adds a <see cref="Notification"/> row to the current unit
/// of work, so it is saved with the change it reports, and the bell will read those rows when it is built.
/// </summary>
public interface INotificationPublisher
{
    void Publish(Guid recipientProfileId, NotificationKind kind, string title, string linkPath);
}
