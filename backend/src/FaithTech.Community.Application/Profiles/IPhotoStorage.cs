namespace FaithTech.Community.Application.Profiles;

/// <summary>A stored image and its content type.</summary>
public record StoredImage(byte[] Content, string ContentType);

/// <summary>
/// Where photos live (ADR 0002). Keys are profiles/{profileId}/{blobId}.{ext} or contacts/{contactId}/{blobId}.{ext};
/// contact photos are only ever read through the API, never through a read URL (ADR 0017).
/// </summary>
public interface IPhotoStorage
{
    /// <summary>A short-lived, read-only URL a signed-in member's browser can load the photo from.</summary>
    string GetReadUrl(string key);

    Task SaveAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken = default);

    /// <summary>The image stored under the key, or null when there is none.</summary>
    Task<StoredImage?> ReadAsync(string key, CancellationToken cancellationToken = default);

    Task DeleteAsync(string key, CancellationToken cancellationToken = default);
}
