namespace FaithTech.Community.Domain.Organisations;

/// <summary>
/// A type of event, as the organisation defines it ([ADR 0035](../../../../docs/adr/0035-configurable-taxonomies.md)):
/// a stable key the events filter carries, a name and an order. Archived, never deleted: events of an archived type keep
/// it and show its name (L2-145 AC4). The organisation keeps at least one active type, which the type handlers enforce.
/// </summary>
public class EventType : IOrganisationScoped
{
    public const int MaxName = 40;

    private EventType() { }

    public EventType(Guid id, string key, string name, int sortOrder)
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

    /// <summary>Never changes: the events filter's <c>type=</c> carries it.</summary>
    public string Key { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public int SortOrder { get; private set; }

    public DateTime? ArchivedAtUtc { get; private set; }

    public bool IsArchived => ArchivedAtUtc is not null;

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

    public void Archive(DateTime nowUtc) => ArchivedAtUtc ??= nowUtc;
}
