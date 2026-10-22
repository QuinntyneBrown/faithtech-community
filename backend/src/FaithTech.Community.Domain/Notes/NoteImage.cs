namespace FaithTech.Community.Domain.Notes;

/// <summary>An image uploaded to a page for an image block (L2-097), stored behind the file storage abstraction.</summary>
public class NoteImage
{
    public const int MaxAlt = 250;
    public const long MaxBytes = 5 * 1024 * 1024;

    private NoteImage() { }

    public NoteImage(Guid pageId, string extension, string contentType, long size, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        PageId = pageId;
        ContentType = contentType;
        Size = size;
        BlobName = $"notes/{pageId}/{Id}.{extension}";
        UploadedAt = now;
    }

    public Guid Id { get; private set; }

    public Guid PageId { get; private set; }

    public string BlobName { get; private set; } = string.Empty;

    public string ContentType { get; private set; } = string.Empty;

    public long Size { get; private set; }

    public DateTimeOffset UploadedAt { get; private set; }
}
