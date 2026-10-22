namespace FaithTech.Community.Domain.Notes;

/// <summary>
/// A page of Docs &amp; notes (L1-022): a title, an optional emoji icon, an optional parent and an ordered list of
/// blocks kept as one JSON document (ADR 0023). Only the owner (or a System Admin) changes it; every save bumps
/// <see cref="Version"/>, the optimistic concurrency token.
/// </summary>
public class NotePage
{
    public const int MaxTitle = 200;
    public const int MaxIcon = 16;

    private readonly List<NoteShareMember> _members = [];
    private readonly List<NoteShareRole> _roles = [];

    private NotePage() { }

    public NotePage(Guid ownerId, string? title, Guid? parentId, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        OwnerId = ownerId;
        Title = title?.Trim() ?? string.Empty;
        ParentId = parentId;
        Visibility = NoteVisibility.Private;
        CreatedAt = now;
        UpdatedAt = now;
        UpdatedById = ownerId;
        Version = 1;
    }

    public Guid Id { get; private set; }

    /// <summary>Empty until the owner names it; shown as "Untitled".</summary>
    public string Title { get; private set; } = string.Empty;

    public string? Icon { get; private set; }

    public Guid OwnerId { get; private set; }

    public Guid? ParentId { get; private set; }

    public NoteVisibility Visibility { get; private set; }

    /// <summary>The blocks as JSON (ADR 0023).</summary>
    public string Content { get; private set; } = "[]";

    /// <summary>The title and every block's text as plain text, for search.</summary>
    public string BodyText { get; private set; } = string.Empty;

    public int Version { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public Guid UpdatedById { get; private set; }

    public DateTimeOffset? ArchivedAt { get; private set; }

    public IReadOnlyList<NoteShareMember> SharedMembers => _members;

    public IReadOnlyList<NoteShareRole> SharedRoles => _roles;

    public bool IsArchived => ArchivedAt is not null;
}
