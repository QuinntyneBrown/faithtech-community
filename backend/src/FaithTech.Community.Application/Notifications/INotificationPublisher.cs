using FaithTech.Community.Domain.Notifications;

namespace FaithTech.Community.Application.Notifications;

/// <summary>The email form of a notification. The link to the related item is appended to the body.</summary>
public record NotificationEmail(string Subject, string Body);

/// <summary>
/// The one way features raise notifications (L2-027, L2-028): an in-app notification per recipient and, when the
/// source has an email form, a queued email. Both join the caller's unit of work, so they are saved with the
/// change they report; the caller saves.
/// </summary>
public interface INotificationPublisher
{
    /// <summary>Adds one in-app notification, with no email.</summary>
    void Publish(Guid recipientProfileId, NotificationKind kind, string title, string linkPath);

    /// <summary>Adds an in-app notification for each recipient and queues the emails; returns how many were queued.</summary>
    Task<int> PublishAsync(
        IReadOnlyCollection<Guid> recipientIds,
        NotificationKind kind,
        string title,
        string linkPath,
        Guid? actorId,
        Func<Guid, NotificationEmail?>? email,
        CancellationToken cancellationToken = default);
}
