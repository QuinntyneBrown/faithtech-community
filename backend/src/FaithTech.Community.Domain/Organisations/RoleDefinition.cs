namespace FaithTech.Community.Domain.Organisations;

/// <summary>
/// A role an organisation defines: a named bundle of capabilities from the platform's catalogue, with flags for the team
/// list, chapter tagging and the oversight banner, and the grant rules naming the roles its holders may add and remove
/// (ADR 0033, docs/detailed-designs/organisations/role-definitions-and-grant-rules). Archived, never deleted.
/// </summary>
public class RoleDefinition : IOrganisationScoped
{
    public const int MaxKeyLength = 60;
    public const int MaxNameLength = 60;
    public const int MaxDescriptionLength = 200;

    private readonly List<RoleGrantRule> _grants = [];

    private RoleDefinition()
    {
        Key = string.Empty;
        Name = string.Empty;
        Description = string.Empty;
    }

    public RoleDefinition(Guid id, string key, string name, string description, IEnumerable<string> capabilities, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > MaxKeyLength)
        {
            throw new ArgumentException("A role definition needs a key of up to 60 characters.", nameof(key));
        }

        Id = id;
        Key = key;
        Name = string.Empty;
        Description = string.Empty;
        SortOrder = sortOrder;
        Rename(name);
        Describe(description);
        SetCapabilities(capabilities);
    }

    public Guid Id { get; private set; }

    public Guid OrganisationId { get; private set; }

    /// <summary>Stable key the seed and the migrations find the definition by; never shown.</summary>
    public string Key { get; private set; }

    public string Name { get; private set; }

    public string Description { get; private set; }

    /// <summary>Catalogue keys this role carries (<see cref="Capability"/>).</summary>
    public string[] Capabilities { get; private set; } = [];

    /// <summary>Whether holders appear on the team list.</summary>
    public bool ShowOnTeam { get; private set; }

    /// <summary>Whether an assignment of this role may be tagged with a chapter.</summary>
    public bool ChapterScopable { get; private set; }

    /// <summary>Whether Home shows holders the "You're viewing as {role}" banner.</summary>
    public bool IsOversight { get; private set; }

    public int SortOrder { get; private set; }

    public DateTime? ArchivedAtUtc { get; private set; }

    public bool IsArchived => ArchivedAtUtc is not null;

    /// <summary>The grant rules this role is the grantor of: the roles its holders may add and remove.</summary>
    public IReadOnlyCollection<RoleGrantRule> Grants => _grants;

    public bool Carries(string capability) => Capabilities.Contains(capability, StringComparer.Ordinal);

    public void Rename(string name)
    {
        var trimmed = name?.Trim() ?? string.Empty;
        if (trimmed.Length is 0 or > MaxNameLength)
        {
            throw new ArgumentException("A role name is 1 to 60 characters.", nameof(name));
        }

        Name = trimmed;
    }

    public void Describe(string? description)
    {
        var trimmed = description?.Trim() ?? string.Empty;
        if (trimmed.Length > MaxDescriptionLength)
        {
            throw new ArgumentException("A role description is up to 200 characters.", nameof(description));
        }

        Description = trimmed;
    }

    public void SetCapabilities(IEnumerable<string> capabilities)
    {
        var set = capabilities.Distinct(StringComparer.Ordinal).ToArray();
        if (set.FirstOrDefault(c => !Capability.IsKnown(c)) is { } unknown)
        {
            throw new ArgumentException($"'{unknown}' is not a capability.", nameof(capabilities));
        }

        Capabilities = set;
    }

    public void SetFlags(bool showOnTeam, bool chapterScopable, bool isOversight)
    {
        ShowOnTeam = showOnTeam;
        ChapterScopable = chapterScopable;
        IsOversight = isOversight;
    }

    /// <summary>Replaces the roles holders of this one may add and remove.</summary>
    public void SetGrantableRoles(IEnumerable<Guid> roleIds)
    {
        var ids = roleIds.Where(id => id != Id).ToHashSet();
        _grants.RemoveAll(g => !ids.Contains(g.GrantableRoleId));
        _grants.AddRange(ids.Where(id => _grants.All(g => g.GrantableRoleId != id)).Select(id => new RoleGrantRule(Id, id)));
    }

    public void Archive(DateTime nowUtc) => ArchivedAtUtc ??= nowUtc;
}
