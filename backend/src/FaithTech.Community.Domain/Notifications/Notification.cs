namespace FaithTech.Community.Domain.Notifications;

public class Notification
{
    private Notification() { }

    public Notification(Guid recipientId, NotificationKind kind, string title, string linkPath, DateTimeOffset createdAt, string? actorName = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(linkPath);
        Id = Guid.NewGuid();
        RecipientId = recipientId;
        Kind = kind;
        Title = title;
        LinkPath = linkPath;
        CreatedAt = createdAt;
        ActorName = string.IsNullOrWhiteSpace(actorName) ? null : actorName;
    }

    public Guid Id { get; private set; }

    public Guid RecipientId { get; private set; }

    public NotificationKind Kind { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string LinkPath { get; private set; } = string.Empty;

    /// <summary>The person whose action raised the notification; shown as the avatar. Null for system notices.</summary>
    public string? ActorName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? ReadAt { get; private set; }

    public bool IsRead => ReadAt is not null;

    public void MarkRead(DateTimeOffset at) => ReadAt ??= at;
}
