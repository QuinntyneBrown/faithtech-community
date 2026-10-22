namespace FaithTech.Community.Domain.Resources;

/// <summary>An uploaded file: its original name, size and type, and where its blob and thumbnail live (ADR 0017).</summary>
public class ResourceFile
{
    private ResourceFile() { }

    public ResourceFile(string fileName, long size, string contentType, string blobName, string? thumbnailBlobName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fileName);
        ArgumentException.ThrowIfNullOrWhiteSpace(blobName);
        FileName = fileName;
        Extension = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        Size = size;
        ContentType = contentType;
        BlobName = blobName;
        ThumbnailBlobName = thumbnailBlobName;
        IsStored = true;
    }

    public string FileName { get; private set; } = string.Empty;

    /// <summary>Lower-case, without the dot: "pptx".</summary>
    public string Extension { get; private set; } = string.Empty;

    public long Size { get; private set; }

    public string ContentType { get; private set; } = string.Empty;

    public string BlobName { get; private set; } = string.Empty;

    public string? ThumbnailBlobName { get; private set; }

    /// <summary>False while the blob waits to be written because storage was down (ADR 0013, 0017).</summary>
    public bool IsStored { get; private set; }

    public void MarkStoring() => IsStored = false;

    public void MarkStored() => IsStored = true;
}
