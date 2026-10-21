namespace FaithTech.Community.Application.Profiles;

/// <summary>Where profile photos live (ADR 0002). Keys are profiles/{profileId}/{blobId}.{ext}.</summary>
public interface IPhotoStorage
{
    /// <summary>A short-lived, read-only URL a signed-in member's browser can load the photo from.</summary>
    string GetReadUrl(string key);

    Task SaveAsync(string key, byte[] content, string contentType, CancellationToken cancellationToken = default);

    Task DeleteAsync(string key, CancellationToken cancellationToken = default);
}
