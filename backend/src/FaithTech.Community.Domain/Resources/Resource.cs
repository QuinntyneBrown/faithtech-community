using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Domain.Resources;

/// <summary>
/// A deck, logo, image, training or template (L1-020): an uploaded file or an https link, with a type, tags and a
/// visibility. Only the owner (or a System Admin) changes it; archiving starts a 30-day wait before the purge.
/// </summary>
public class Resource : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    public const int MaxTitle = 120;
    public const int MaxDescription = 1000;
    public const int MaxTag = 40;
    public static readonly TimeSpan PurgeAfter = TimeSpan.FromDays(30);

    private readonly List<ResourceTag> _tags = [];
    private readonly List<ResourceShareMember> _members = [];
    private readonly List<ResourceShareRole> _roles = [];

    private Resource() { }

    private Resource(Guid id, string title, string? description, ResourceType type, Guid ownerId, DateTimeOffset now)
    {
        Id = id;
        OwnerId = ownerId;
        AddedAt = now;
        SetDetails(title, description, type);
    }

    public Guid Id { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public ResourceType Type { get; private set; }

    public ResourceVisibility Visibility { get; private set; }

    public Guid OwnerId { get; private set; }

    /// <summary>
    /// The key of the contributing role the owner held when they became the owner, named if they later lose it (L2-064 AC2).
    /// </summary>
    public string? OwnerRole { get; private set; }

    public DateTimeOffset AddedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? UpdatedById { get; private set; }

    public DateTimeOffset? FileReplacedAt { get; private set; }

    public Guid? FileReplacedById { get; private set; }

    public DateTimeOffset? ArchivedAt { get; private set; }

    public ResourceFile? File { get; private set; }

    public string? LinkUrl { get; private set; }

    public string? LinkHost { get; private set; }

    /// <summary>The tags joined by spaces, kept for the search vector (ADR 0017).</summary>
    public string TagText { get; private set; } = string.Empty;

    public IReadOnlyList<ResourceTag> Tags => _tags;

    public IReadOnlyList<ResourceShareMember> SharedMembers => _members;

    public IReadOnlyList<ResourceShareRole> SharedRoles => _roles;

    public bool IsArchived => ArchivedAt is not null;

    public bool IsLink => LinkUrl is not null;

    public static Resource ForFile(
        Guid id, string title, string? description, ResourceType type, Guid ownerId, ResourceFile file, DateTimeOffset now) =>
        new(id, title, description, type, ownerId, now) { File = file };

    public static Resource ForLink(
        string title, string? description, ResourceType type, Guid ownerId, Uri link, DateTimeOffset now, Guid? id = null)
    {
        var resource = new Resource(id ?? Guid.NewGuid(), title, description, type, ownerId, now);
        resource.SetLink(link);
        return resource;
    }

    /// <summary>Tags lower-cased, trimmed and de-duplicated, empty ones dropped (L2-059 AC4).</summary>
    public static IReadOnlyList<string> NormaliseTags(IEnumerable<string?>? tags) =>
        [.. (tags ?? []).Select(t => (t ?? string.Empty).Trim().ToLowerInvariant()).Where(t => t.Length > 0).Distinct()];

    public void SetDetails(string title, string? description, ResourceType type)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        Title = title.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Type = type;
    }

    public void SetTags(IEnumerable<string?>? tags)
    {
        var normalised = NormaliseTags(tags);
        _tags.RemoveAll(t => !normalised.Contains(t.Tag));
        foreach (var tag in normalised.Where(n => _tags.All(t => t.Tag != n)))
        {
            _tags.Add(new ResourceTag(Id, tag));
        }

        TagText = string.Join(' ', normalised);
    }

    /// <summary>Sets the visibility and, for Shared, the named members and roles; any other visibility clears them.</summary>
    public void SetAudience(ResourceAudience audience)
    {
        Visibility = audience.Visibility;
        _members.RemoveAll(m => !audience.Members.Contains(m.ProfileId));
        _roles.RemoveAll(r => !audience.RoleIds.Contains(r.RoleDefinitionId));
        _members.AddRange(audience.Members.Where(m => _members.All(x => x.ProfileId != m)).Select(m => new ResourceShareMember(Id, m)));
        _roles.AddRange(audience.Roles.Where(r => _roles.All(x => x.RoleDefinitionId != r.Id)).Select(r => new ResourceShareRole(Id, r)));
    }

    public void SetLink(Uri link)
    {
        if (link.Scheme != Uri.UriSchemeHttps)
        {
            throw new ArgumentException("Links must use https.", nameof(link));
        }

        LinkUrl = link.ToString();
        LinkHost = link.Host.StartsWith("www.", StringComparison.OrdinalIgnoreCase) ? link.Host[4..] : link.Host;
    }

    public void Touch(Guid by, DateTimeOffset now)
    {
        UpdatedAt = now;
        UpdatedById = by;
    }

    /// <summary>Swaps the file in place: same id and URL, no versions (L2-062 AC2). Returns the file it replaced.</summary>
    public ResourceFile ReplaceFile(ResourceFile file, Guid by, DateTimeOffset now)
    {
        var old = File ?? throw new InvalidOperationException("A link resource has no file to replace.");
        File = file;
        FileReplacedAt = now;
        FileReplacedById = by;
        Touch(by, now);
        return old;
    }

    public void Archive(DateTimeOffset now) => ArchivedAt = now;

    public void Restore() => ArchivedAt = null;

    public DateTimeOffset? PurgeAt => ArchivedAt + PurgeAfter;

    public bool IsPurgeDue(DateTimeOffset now) => ArchivedAt is { } at && now >= at + PurgeAfter;

    public void SetOwner(Guid ownerId, string? ownerRole)
    {
        OwnerId = ownerId;
        OwnerRole = ownerRole;
    }
}
