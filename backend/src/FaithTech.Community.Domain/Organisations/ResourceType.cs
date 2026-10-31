namespace FaithTech.Community.Domain.Organisations;

/// <summary>
/// A type of resource, as the organisation defines it ([ADR 0035](../../../../docs/adr/0035-configurable-taxonomies.md)):
/// a stable key the upload guess maps to, a name and an order. Archived, never deleted: resources of an archived type keep
/// it and show its name (L2-146 AC4). The type keyed <c>other</c> is the fallback for a guessed type the organisation
/// does not have, so it can never be archived (L2-146 AC1, AC3).
/// </summary>
public class ResourceType : IOrganisationScoped
{
    public const int MaxName = 40;

    /// <summary>The key of the fallback type every organisation keeps.</summary>
    public const string OtherKey = "other";

    private ResourceType() { }

    public ResourceType(Guid id, string key, string name, int sortOrder)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        Id = id;
        Key = key;
        Rename(name);
        SortOrder = sortOrder;
    }

    public Guid Id { get; private set; }

    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    /// <summary>Never changes: the upload guess and the seed name it.</summary>
    public string Key { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public int SortOrder { get; private set; }

    public DateTime? ArchivedAtUtc { get; private set; }

    public bool IsArchived => ArchivedAtUtc is not null;

    public bool CanArchive => Key != OtherKey;

    public void Rename(string name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxName)
        {
            throw new ArgumentException($"A type name is required and at most {MaxName} characters.", nameof(name));
        }

        Name = trimmed;
    }

    public void MoveTo(int sortOrder) => SortOrder = sortOrder;

    public void Archive(DateTime nowUtc)
    {
        if (!CanArchive)
        {
            throw new InvalidOperationException("The type keyed other cannot be archived.");
        }

        ArchivedAtUtc ??= nowUtc;
    }
}
