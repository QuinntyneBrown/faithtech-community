namespace FaithTech.Community.Domain.Partners;

public class Partner
{
    private readonly List<PartnerStageChange> _stageChanges = [];

    private Partner() { }

    public Partner(
        string name,
        string? website,
        string? offering,
        Guid? ownerId,
        string? contactName,
        string? email,
        string? phone,
        string? notes,
        PartnerStage stage = PartnerStage.Lead)
    {
        Id = Guid.NewGuid();
        Stage = stage;
        Update(name, website, offering, ownerId, contactName, email, phone, notes);
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Website { get; private set; }

    public string? Offering { get; private set; }

    public Guid? OwnerId { get; private set; }

    public string? ContactName { get; private set; }

    public string? Email { get; private set; }

    public string? Phone { get; private set; }

    public string? Notes { get; private set; }

    public PartnerStage Stage { get; private set; }

    public IReadOnlyCollection<PartnerStageChange> StageChanges => _stageChanges;

    /// <summary>The concurrency token merge and restore compare (ADR 0028).</summary>
    public int Version { get; private set; }

    /// <summary>Set when a merge archived this record into another one (ADR 0028).</summary>
    public DateTime? ArchivedAtUtc { get; private set; }

    public Guid? MergedIntoId { get; private set; }

    public Guid? MergedById { get; private set; }

    public DateTime? MergedAtUtc { get; private set; }

    public bool IsArchived => ArchivedAtUtc is not null;

    public void Update(
        string name,
        string? website,
        string? offering,
        Guid? ownerId,
        string? contactName,
        string? email,
        string? phone,
        string? notes)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name;
        Website = website;
        Offering = offering;
        OwnerId = ownerId;
        ContactName = contactName;
        Email = email;
        Phone = phone;
        Notes = notes;
        Version++;
    }

    public void MoveTo(PartnerStage stage, Guid by, DateTime nowUtc, string? note)
    {
        if (stage == Stage)
        {
            throw new InvalidOperationException($"The partner is already at the {stage} stage.");
        }

        _stageChanges.Add(new PartnerStageChange(Id, Stage, stage, by, nowUtc, note));
        Stage = stage;
        Version++;
    }

    /// <summary>The kept record of a merge takes the chosen values and the joined notes; no stage change is recorded (ADR 0028).</summary>
    public void AbsorbMerge(PartnerMergeValues values, string? notes)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(values.Name);
        Name = values.Name;
        Stage = values.Stage;
        ContactName = values.ContactName;
        Email = values.Email;
        Phone = values.Phone;
        Website = values.Website;
        Offering = values.Offering;
        OwnerId = values.OwnerId;
        Notes = notes;
        Version++;
    }

    public void ArchiveAsMergedInto(Guid keptId, Guid by, DateTime nowUtc)
    {
        if (IsArchived)
        {
            throw new InvalidOperationException($"{Name} has already been merged.");
        }

        if (keptId == Id)
        {
            throw new InvalidOperationException("A partner cannot be merged into itself.");
        }

        ArchivedAtUtc = nowUtc;
        MergedIntoId = keptId;
        MergedById = by;
        MergedAtUtc = nowUtc;
        Version++;
    }

    /// <summary>Makes an archived partner active again; its moved rows come back through their own MoveBack.</summary>
    public void Restore()
    {
        if (!IsArchived)
        {
            throw new InvalidOperationException($"{Name} is not archived.");
        }

        ArchivedAtUtc = null;
        MergedIntoId = null;
        MergedById = null;
        MergedAtUtc = null;
        Version++;
    }

    /// <summary>The kept record of a restore changes only by losing rows, so only its version moves.</summary>
    public void TouchForRestore() => Version++;
}

/// <summary>The eight values a merge's kept record takes (L2-114 AC1).</summary>
public record PartnerMergeValues(
    string Name,
    PartnerStage Stage,
    string? ContactName,
    string? Email,
    string? Phone,
    string? Website,
    string? Offering,
    Guid? OwnerId);
