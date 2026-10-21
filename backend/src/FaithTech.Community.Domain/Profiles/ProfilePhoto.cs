namespace FaithTech.Community.Domain.Profiles;

public class ProfilePhoto
{
    private ProfilePhoto() { }

    public ProfilePhoto(string blobName, string altText, DateTimeOffset uploadedAt)
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

    public void Describe(string altText)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(altText);
        AltText = altText;
    }

    internal void SetFeatured(bool featured) => IsFeatured = featured;
}
