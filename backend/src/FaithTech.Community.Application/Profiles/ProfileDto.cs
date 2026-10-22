using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Profiles;

/// <summary>A profile photo. <c>Url</c> is null while <c>IsStored</c> is false: the photo is saved and its image is still being written to storage.</summary>
public record PhotoDto(Guid Id, string? Url, string AltText, bool IsFeatured, DateTimeOffset UploadedAt, bool IsStored)
{
    public static PhotoDto From(ProfilePhoto photo, IPhotoStorage storage) =>
        new(photo.Id, photo.IsStored ? storage.GetReadUrl(photo.BlobName) : null, photo.AltText, photo.IsFeatured, photo.UploadedAt, photo.IsStored);
}

/// <summary>A profile as a signed-in member sees it (L2-005). Photos are newest first.</summary>
public record ProfileDto(
    Guid Id,
    string Name,
    string? HomeCity,
    string? Bio,
    PhotoDto? FeaturedPhoto,
    IReadOnlyList<PhotoDto> Photos,
    IReadOnlyList<string> Roles,
    bool IsOwn,
    bool CanEdit);
