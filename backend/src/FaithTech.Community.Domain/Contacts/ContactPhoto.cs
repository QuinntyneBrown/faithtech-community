namespace FaithTech.Community.Domain.Contacts;

/// <summary>A photo of a private contact (L2-067, L2-068); as private as the contact.</summary>
public class ContactPhoto
{
    private ContactPhoto() { }

    public ContactPhoto(string blobName, string altText, DateTimeOffset uploadedAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(blobName);
        ArgumentException.ThrowIfNullOrWhiteSpace(altText);
        Id = Guid.NewGuid();
        BlobName = blobName;
        AltText = altText;
        UploadedAt = uploadedAt;
    }

    public Guid Id { get; private set; }

    public string BlobName { get; private set; } = string.Empty;

    public string AltText { get; private set; } = string.Empty;

    public bool IsFeatured { get; private set; }

    public DateTimeOffset UploadedAt { get; private set; }

    /// <summary>False while its blob waits to be written because storage was unavailable (L2-071 AC1).</summary>
    public bool IsStored { get; private set; } = true;

    public void MarkStoring() => IsStored = false;

    public void MarkStored() => IsStored = true;

    public void Describe(string altText)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(altText);
        AltText = altText;
    }

    internal void SetFeatured(bool featured) => IsFeatured = featured;
}
