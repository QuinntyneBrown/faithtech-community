using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Domain.Contacts;

public class Contact : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    public const int MaxPhotos = 10;

    private readonly List<ContactNote> _notes = [];
    private readonly List<ContactPhoto> _photos = [];

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

    public IReadOnlyCollection<ContactPhoto> Photos => _photos;

    /// <summary>Serializes writes to <see cref="Photos"/> across requests (L2-071 AC3).</summary>
    public PhotoLease PhotoLease { get; private set; } = new();

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

    /// <summary>Adds a photo; the first one is featured. A contact holds at most <see cref="MaxPhotos"/>.</summary>
    public void AddPhoto(ContactPhoto photo)
    {
        if (_photos.Count >= MaxPhotos)
        {
            throw new InvalidOperationException($"A contact holds at most {MaxPhotos} photos.");
        }

        photo.SetFeatured(_photos.Count == 0);
        _photos.Add(photo);
    }

    public void Feature(Guid photoId)
    {
        var featured = FindPhoto(photoId);
        foreach (var photo in _photos)
        {
            photo.SetFeatured(photo == featured);
        }
    }

    /// <summary>Removes a photo; when it was featured, the most recently uploaded remaining photo takes over.</summary>
    public void RemovePhoto(Guid photoId)
    {
        var removed = FindPhoto(photoId);
        _photos.Remove(removed);
        if (removed.IsFeatured && _photos.Count > 0)
        {
            Feature(_photos.MaxBy(p => p.UploadedAt)!.Id);
        }
    }

    private ContactPhoto FindPhoto(Guid photoId) =>
        _photos.FirstOrDefault(p => p.Id == photoId)
            ?? throw new InvalidOperationException("The contact has no such photo.");
}
