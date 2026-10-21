namespace FaithTech.Community.Domain.Contacts;

public class ContactNote
{
    private ContactNote() { }

    internal ContactNote(Guid contactId, string body, DateTime createdAtUtc)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(body);
        Id = Guid.NewGuid();
        ContactId = contactId;
        Body = body;
        CreatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid ContactId { get; private set; }

    public string Body { get; private set; } = string.Empty;

    public DateTime CreatedAtUtc { get; private set; }
}
