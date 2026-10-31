using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Partners;

public class PartnerStageChange : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    private PartnerStageChange() { }

    internal PartnerStageChange(Guid partnerId, PartnerStage from, PartnerStage to, Guid movedBy, DateTime movedAtUtc, string? note)
    {
        Id = Guid.NewGuid();
        PartnerId = partnerId;
        From = from;
        To = to;
        MovedBy = movedBy;
        MovedAtUtc = movedAtUtc;
        Note = note;
    }

    public Guid Id { get; private set; }

    public Guid PartnerId { get; private set; }

    public PartnerStage From { get; private set; }

    public PartnerStage To { get; private set; }

    public Guid MovedBy { get; private set; }

    public DateTime MovedAtUtc { get; private set; }

    public string? Note { get; private set; }

    /// <summary>The partner this change was first recorded on, when a merge moved it (ADR 0028).</summary>
    public Guid? MergedFromPartnerId { get; private set; }

    /// <summary>A merge moves the change to the kept record; the first record it was written on is kept through a chain.</summary>
    public void MoveTo(Guid partnerId)
    {
        MergedFromPartnerId ??= PartnerId;
        PartnerId = partnerId;
    }

    /// <summary>A restore moves the change back to the record it was first written on.</summary>
    public void MoveBack()
    {
        PartnerId = MergedFromPartnerId ?? throw new InvalidOperationException("The stage change was never moved.");
        MergedFromPartnerId = null;
    }
}
