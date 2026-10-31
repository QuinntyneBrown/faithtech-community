using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Notes;

/// <summary>An image uploaded to a page for an image block (L2-097), stored behind the file storage abstraction.</summary>
public class NoteImage : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    public const int MaxAlt = 250;
    public const long MaxBytes = 5 * 1024 * 1024;

    private NoteImage() { }

    public NoteImage(Guid organisationId, Guid pageId, string extension, string contentType, long size, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        OrganisationId = organisationId;
        PageId = pageId;
        ContentType = contentType;
        Size = size;
        BlobName = $"{organisationId}/notes/{pageId}/{Id}.{extension}";
        UploadedAt = now;
    }

    public Guid Id { get; private set; }

    public Guid PageId { get; private set; }

    public string BlobName { get; private set; } = string.Empty;

    public string ContentType { get; private set; } = string.Empty;

    public long Size { get; private set; }

    public DateTimeOffset UploadedAt { get; private set; }
}
