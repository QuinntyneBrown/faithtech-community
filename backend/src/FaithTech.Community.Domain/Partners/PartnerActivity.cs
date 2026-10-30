namespace FaithTech.Community.Domain.Partners;

/// <summary>Call, Email, Meeting and Note are logged by people; the rest are written by the system.</summary>
public enum PartnerActivityKind
{
    Call,
    Email,
    Meeting,
    Note,
    Added,
    StageMoved,
    Merged,
    Restored,
}

public static class PartnerActivityKinds
{
    public static readonly PartnerActivityKind[] Logged =
        [PartnerActivityKind.Call, PartnerActivityKind.Email, PartnerActivityKind.Meeting, PartnerActivityKind.Note];

    /// <summary>The system entries the Stage moves filter shows.</summary>
    public static readonly PartnerActivityKind[] Stage =
        [PartnerActivityKind.Added, PartnerActivityKind.StageMoved, PartnerActivityKind.Merged, PartnerActivityKind.Restored];
}

/// <summary>
/// One dated touchpoint on a partner's shared timeline (L2-110). Logged entries cannot be edited
/// or deleted in v1; system entries mirror a change to the partner.
/// </summary>
public class PartnerActivity
{
    private PartnerActivity() { }

    private PartnerActivity(Guid partnerId, PartnerActivityKind kind, Guid by, DateTime nowUtc)
    {
        Id = Guid.NewGuid();
        PartnerId = partnerId;
        Kind = kind;
        LoggedById = by;
        LoggedAtUtc = nowUtc;
        OccurredOn = DateOnly.FromDateTime(nowUtc);
        OccurredAt = TimeOnly.FromDateTime(nowUtc);
    }

    public Guid Id { get; private set; }

    public Guid PartnerId { get; private set; }

    public PartnerActivityKind Kind { get; private set; }

    /// <summary>What happened (logged kinds), or the move note (StageMoved).</summary>
    public string? Summary { get; private set; }

    public DateOnly OccurredOn { get; private set; }

    public TimeOnly? OccurredAt { get; private set; }

    public string? NextStep { get; private set; }

    public DateOnly? NextStepDue { get; private set; }

    public Guid LoggedById { get; private set; }

    public DateTime LoggedAtUtc { get; private set; }

    public PartnerStage? FromStage { get; private set; }

    public PartnerStage? ToStage { get; private set; }

    /// <summary>The stage change a StageMoved entry mirrors.</summary>
    public Guid? StageChangeId { get; private set; }

    /// <summary>The other partner of a Merged or Restored entry.</summary>
    public Guid? RelatedPartnerId { get; private set; }

    /// <summary>The partner this entry was first written on, when a merge moved it (ADR 0028).</summary>
    public Guid? MergedFromPartnerId { get; private set; }

    public static PartnerActivity Log(
        Guid partnerId,
        PartnerActivityKind kind,
        string summary,
        DateOnly occurredOn,
        TimeOnly? occurredAt,
        string? nextStep,
        DateOnly? nextStepDue,
        Guid by,
        DateTime nowUtc)
    {
        if (!PartnerActivityKinds.Logged.Contains(kind))
        {
            throw new ArgumentException($"{kind} is written by the system, not logged.", nameof(kind));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(summary);
        if (nextStepDue is not null && string.IsNullOrWhiteSpace(nextStep))
        {
            throw new ArgumentException("A due date needs a next step.", nameof(nextStepDue));
        }

        return new PartnerActivity(partnerId, kind, by, nowUtc)
        {
            Summary = summary,
            OccurredOn = occurredOn,
            OccurredAt = occurredAt,
            NextStep = nextStep,
            NextStepDue = nextStepDue,
        };
    }

    /// <summary>The partner entered the pipeline at its first stage (L2-110 AC6).</summary>
    public static PartnerActivity Added(Partner partner, Guid by, DateTime nowUtc) =>
        new(partner.Id, PartnerActivityKind.Added, by, nowUtc) { ToStage = partner.Stage };

    /// <summary>Written on the kept record of a merge, with the stages when the merge changed it (L2-114 AC3).</summary>
    public static PartnerActivity Merged(Partner kept, Partner other, Guid by, DateTime nowUtc, PartnerStage? fromStage, PartnerStage? toStage) =>
        new(kept.Id, PartnerActivityKind.Merged, by, nowUtc) { RelatedPartnerId = other.Id, FromStage = fromStage, ToStage = toStage };

    /// <summary>
    /// Written on both records of a restore (L2-115 AC4). The restored record's entry carries the
    /// stage it comes back at, which is how the timeline tells the two sides apart.
    /// </summary>
    public static PartnerActivity Restored(Partner partner, Partner other, Guid by, DateTime nowUtc, bool isRestoredRecord) =>
        new(partner.Id, PartnerActivityKind.Restored, by, nowUtc)
        {
            RelatedPartnerId = other.Id,
            ToStage = isRestoredRecord ? partner.Stage : null,
        };

    /// <summary>A merge moves the entry to the kept record; the first record it was written on is kept through a chain.</summary>
    public void MoveTo(Guid partnerId)
    {
        MergedFromPartnerId ??= PartnerId;
        PartnerId = partnerId;
    }

    /// <summary>A restore moves the entry back to the record it was first written on.</summary>
    public void MoveBack()
    {
        PartnerId = MergedFromPartnerId ?? throw new InvalidOperationException("The entry was never moved.");
        MergedFromPartnerId = null;
    }

    /// <summary>Mirrors a stage change, with its note (L2-110 AC7).</summary>
    public static PartnerActivity StageMoved(PartnerStageChange change) =>
        new(change.PartnerId, PartnerActivityKind.StageMoved, change.MovedBy, change.MovedAtUtc)
        {
            Summary = change.Note,
            FromStage = change.From,
            ToStage = change.To,
            StageChangeId = change.Id,
        };
}
