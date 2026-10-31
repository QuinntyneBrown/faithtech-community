namespace FaithTech.Community.Domain.Organisations;

/// <summary>Whether partners on a stage count as confirmed on Home and in Reports (L2-144 AC5).</summary>
public enum PartnerStageKind
{
    Open,
    Confirmed,
}

/// <summary>
/// A column of the partner pipeline, as the organisation defines it ([ADR 0035](../../../../docs/adr/0035-configurable-taxonomies.md)):
/// a stable key the history records, a name, an order, whether new partners start on it and its kind. Archived, never
/// deleted; an archived stage is never initial. The organisation keeps exactly one active initial stage and at least one
/// active stage (L2-144 AC2), which the stage handlers enforce across the list.
/// </summary>
public class PartnerStage : IOrganisationScoped
{
    public const int MaxName = 40;

    private PartnerStage() { }

    public PartnerStage(Guid id, string key, string name, int sortOrder, bool isInitial = false, PartnerStageKind kind = PartnerStageKind.Open)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        Id = id;
        Key = key;
        Rename(name);
        SortOrder = sortOrder;
        IsInitial = isInitial;
        Kind = kind;
    }

    public Guid Id { get; private set; }

    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    /// <summary>Never changes: partner history and merges compare keys, so a rename shows everywhere.</summary>
    public string Key { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public int SortOrder { get; private set; }

    public bool IsInitial { get; private set; }

    public PartnerStageKind Kind { get; private set; }

    public DateTime? ArchivedAtUtc { get; private set; }

    public bool IsArchived => ArchivedAtUtc is not null;

    public void Rename(string name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxName)
        {
            throw new ArgumentException($"A stage name is required and at most {MaxName} characters.", nameof(name));
        }

        Name = trimmed;
    }

    public void MoveTo(int sortOrder) => SortOrder = sortOrder;

    public void MarkInitial(bool initial) => IsInitial = initial;

    public void SetKind(PartnerStageKind kind) => Kind = kind;

    public void Archive(DateTime nowUtc)
    {
        ArchivedAtUtc ??= nowUtc;
        IsInitial = false;
    }
}
