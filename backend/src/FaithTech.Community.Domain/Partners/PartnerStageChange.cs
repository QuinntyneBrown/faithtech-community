namespace FaithTech.Community.Domain.Partners;

public class PartnerStageChange
{
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
}
