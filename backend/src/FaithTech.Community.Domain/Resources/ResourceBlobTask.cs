using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Domain.Resources;

public enum ResourceBlobWork
{
    Save,
    Delete,
}

/// <summary>Resource blob work that failed while storage was down and is retried later (ADR 0013, ADR 0017).</summary>
public class ResourceBlobTask : IOrganisationScoped
{
    /// <summary>The organisation the record belongs to, stamped when it is saved (ADR 0032).</summary>
    public Guid OrganisationId { get; private set; }

    private static readonly TimeSpan MaxBackoff = TimeSpan.FromHours(1);

    private ResourceBlobTask() { }

    private ResourceBlobTask(ResourceBlobWork work, Guid resourceId, string blobName, byte[]? content, string? contentType, DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        Work = work;
        ResourceId = resourceId;
        BlobName = blobName;
        Content = content;
        ContentType = contentType;
        CreatedAt = now;
        NextAttemptAt = now;
    }

    public Guid Id { get; private set; }

    public ResourceBlobWork Work { get; private set; }

    public Guid ResourceId { get; private set; }

    public string BlobName { get; private set; } = string.Empty;

    public byte[]? Content { get; private set; }

    public string? ContentType { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset NextAttemptAt { get; private set; }

    public int Attempts { get; private set; }

    public static ResourceBlobTask Save(Guid resourceId, string blobName, byte[] content, string contentType, DateTimeOffset now) =>
        new(ResourceBlobWork.Save, resourceId, blobName, content, contentType, now);

    public static ResourceBlobTask Delete(Guid resourceId, string blobName, DateTimeOffset now) =>
        new(ResourceBlobWork.Delete, resourceId, blobName, null, null, now);

    public void Failed(DateTimeOffset now)
    {
        Attempts++;
        var backoff = TimeSpan.FromMinutes(Math.Pow(2, Math.Min(Attempts, 6)));
        NextAttemptAt = now + (backoff < MaxBackoff ? backoff : MaxBackoff);
    }
}
