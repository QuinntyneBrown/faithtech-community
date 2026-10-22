namespace FaithTech.Community.Domain.Contacts;

/// <summary>
/// A person who asked, through a lead's connect link, to become that lead's contact before their email was
/// verified (ADR 0022). Verifying the email turns it into a linked contact.
/// </summary>
public class PendingConnection
{
    private PendingConnection() { }

    public PendingConnection(Guid profileId, Guid leadId, DateTimeOffset createdAt)
    {
        Id = Guid.NewGuid();
        ProfileId = profileId;
        LeadId = leadId;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid ProfileId { get; private set; }

    public Guid LeadId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
}
