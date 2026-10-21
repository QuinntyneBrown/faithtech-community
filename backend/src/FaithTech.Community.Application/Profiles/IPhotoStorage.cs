namespace FaithTech.Community.Application.Profiles;

/// <summary>Where profile photos live (ADR 0002). Keys are profiles/{profileId}/{photoId}.{ext}.</summary>
public interface IPhotoStorage
{
    /// <summary>A short-lived, read-only URL a signed-in member's browser can load the photo from.</summary>
    string GetReadUrl(string key);
}
