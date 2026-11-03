using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Notifications;

public class Notification : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    private Notification() { }

    public Notification(
        Guid recipientId,
        NotificationKind kind,
        string title,
        string linkPath,
        DateTimeOffset createdAt,
        Guid? actorId = null,
        string? linkText = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(linkPath);
        if (linkText is not null && (linkText.Trim().Length == 0 || !title.Contains(linkText, StringComparison.Ordinal)))
        {
            throw new ArgumentException("The link text must be a phrase of the title.", nameof(linkText));
        }

        LinkText = linkText;
        Id = Guid.NewGuid();
        RecipientId = recipientId;
        Kind = kind;
        Title = title;
        LinkPath = linkPath;
        CreatedAt = createdAt;
        ActorId = actorId;
    }

    public Guid Id { get; private set; }

    public Guid RecipientId { get; private set; }

    public NotificationKind Kind { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string LinkPath { get; private set; } = string.Empty;

    /// <summary>The member whose action raised the notification, when there is one; the notice shows their initials.</summary>
    public Guid? ActorId { get; private set; }

    /// <summary>
    /// The phrase of the title that names the item, such as an event's title; only it is the notice's link and the
    /// rest of the sentence is plain text (L2-027 AC7). Without one the whole title is the link.
    /// </summary>
    public string? LinkText { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? ReadAt { get; private set; }

    public bool IsRead => ReadAt is not null;

    public void MarkRead(DateTimeOffset at) => ReadAt ??= at;
}
