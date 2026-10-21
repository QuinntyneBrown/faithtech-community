namespace FaithTech.Community.Domain.Notifications;

public class Notification
{
    private Notification() { }

    public Notification(Guid recipientId, NotificationKind kind, string title, string linkPath, DateTimeOffset createdAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(linkPath);
        Id = Guid.NewGuid();
        RecipientId = recipientId;
        Kind = kind;
        Title = title;
        LinkPath = linkPath;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid RecipientId { get; private set; }

    public NotificationKind Kind { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string LinkPath { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? ReadAt { get; private set; }

    public bool IsRead => ReadAt is not null;

    public void MarkRead(DateTimeOffset at) => ReadAt ??= at;
}
