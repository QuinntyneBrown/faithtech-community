namespace FaithTech.Community.Domain.Contacts;

public class Contact
{
    private readonly List<ContactNote> _notes = [];

    private Contact() { }

    public Contact(Guid ownerId, string name, string? email, string? phone, string? organization, string? city, DateTime createdAtUtc)
    {
        Id = Guid.NewGuid();
        OwnerId = ownerId;
        CreatedAtUtc = createdAtUtc;
        Update(name, email, phone, organization, city);
    }

    public Guid Id { get; private set; }

    public Guid OwnerId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Email { get; private set; }

    public string? Phone { get; private set; }

    public string? Organization { get; private set; }

    public string? City { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public Guid? LinkedProfileId { get; private set; }

    public DateTime? ArchivedAtUtc { get; private set; }

    public bool IsArchived => ArchivedAtUtc is not null;

    public bool CanBeDeleted => IsArchived;

    public IReadOnlyCollection<ContactNote> Notes => _notes;

    public void Update(string name, string? email, string? phone, string? organization, string? city)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name;
        Email = email;
        Phone = phone;
        Organization = organization;
        City = city;
    }

    public ContactNote AddNote(string body, DateTime nowUtc)
    {
        var note = new ContactNote(Id, body, nowUtc);
        _notes.Add(note);
        return note;
    }

    public void Archive(DateTime nowUtc)
    {
        if (IsArchived)
        {
            throw new InvalidOperationException("The contact is already archived.");
        }

        ArchivedAtUtc = nowUtc;
    }

    public void Restore()
    {
        if (!IsArchived)
        {
            throw new InvalidOperationException("The contact is not archived.");
        }

        ArchivedAtUtc = null;
    }

    public void LinkTo(Guid profileId, bool discardNotes = false)
    {
        if (LinkedProfileId is not null)
        {
            throw new InvalidOperationException("The contact is already linked to a profile.");
        }

        LinkedProfileId = profileId;
        if (discardNotes)
        {
            _notes.Clear();
        }
    }
}
