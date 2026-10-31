using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Partners;

/// <summary>
/// "Not the same": two possible duplicates a lead said are different partners (L2-113 AC6, ADR 0027).
/// The pair is stored once, lower id first, whichever partner it was chosen from.
/// </summary>
public class PartnerDuplicateDismissal : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    private PartnerDuplicateDismissal() { }

    public Guid Id { get; private set; }

    public Guid LowerPartnerId { get; private set; }

    public Guid HigherPartnerId { get; private set; }

    public Guid DismissedById { get; private set; }

    public DateTime DismissedAtUtc { get; private set; }

    public static PartnerDuplicateDismissal For(Guid a, Guid b, Guid by, DateTime nowUtc)
    {
        if (a == b)
        {
            throw new ArgumentException("A partner cannot be a duplicate of itself.", nameof(b));
        }

        var (lower, higher) = a.CompareTo(b) < 0 ? (a, b) : (b, a);
        return new PartnerDuplicateDismissal
        {
            Id = Guid.NewGuid(),
            LowerPartnerId = lower,
            HigherPartnerId = higher,
            DismissedById = by,
            DismissedAtUtc = nowUtc,
        };
    }
}
