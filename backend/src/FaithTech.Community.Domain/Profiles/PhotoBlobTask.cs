namespace FaithTech.Community.Domain.Profiles;

public enum PhotoBlobWork
{
    /// <summary>Write the processed image held in <see cref="PhotoBlobTask.Content"/>.</summary>
    Save,

    /// <summary>Delete the blob of a photo that has been removed.</summary>
    Delete,
}

/// <summary>
/// Blob storage work that failed during a photo action and is retried later, so the action itself
/// still commits while storage is down (L2-047 AC3).
/// </summary>
public class PhotoBlobTask
{
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromHours(1);

    private PhotoBlobTask() { }

    private PhotoBlobTask(PhotoBlobWork work, Guid photoId, string blobName, byte[]? content, string? contentType, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        Work = work;
        PhotoId = photoId;
        BlobName = blobName;
        Content = content;
        ContentType = contentType;
        CreatedAt = now;
        NextAttemptAt = now;
    }

    public Guid Id { get; private set; }

    public PhotoBlobWork Work { get; private set; }

    public Guid PhotoId { get; private set; }

    public string BlobName { get; private set; } = string.Empty;

    public byte[]? Content { get; private set; }

    public string? ContentType { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset NextAttemptAt { get; private set; }

    public int Attempts { get; private set; }

    public static PhotoBlobTask Save(ProfilePhoto photo, byte[] content, string contentType, DateTimeOffset now) =>
        new(PhotoBlobWork.Save, photo.Id, photo.BlobName, content, contentType, now);

    public static PhotoBlobTask Delete(ProfilePhoto photo, DateTimeOffset now) =>
        new(PhotoBlobWork.Delete, photo.Id, photo.BlobName, null, null, now);

    /// <summary>Schedules the next try with exponential backoff, at most an hour apart.</summary>
    public void Failed(DateTimeOffset now)
    {
        Attempts++;
        var backoff = TimeSpan.FromMinutes(Math.Pow(2, Math.Min(Attempts, 6)));
        NextAttemptAt = now + (backoff < MaxBackoff ? backoff : MaxBackoff);
    }
}
