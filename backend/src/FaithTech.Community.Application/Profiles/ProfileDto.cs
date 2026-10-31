using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Profiles;

/// <summary>A profile photo. <c>Url</c> is null while <c>IsStored</c> is false: the photo is saved and its image is still being written to storage.</summary>
public record PhotoDto(Guid Id, string? Url, string AltText, bool IsFeatured, DateTimeOffset UploadedAt, bool IsStored)
{
    public static PhotoDto From(ProfilePhoto photo, IPhotoStorage storage) =>
        new(photo.Id, photo.IsStored ? storage.GetReadUrl(photo.BlobName) : null, photo.AltText, photo.IsFeatured, photo.UploadedAt, photo.IsStored);
}

/// <summary>
/// A role a profile holds, by the organisation's definition: what the profile, People and the role routes answer
/// (L2-138 AC1). <c>ChapterId</c> is its chapter tag, once chapters exist (slice 21).
/// </summary>
/// <summary>
/// A held role: the definition, and the chapter it is tagged with. ChapterName is null when untagged and while chapters
/// are off, so the badge reads "{role}"; otherwise "{role} · {chapter}" (L2-141 AC3).
/// </summary>
public record ProfileRoleDto(Guid Id, string Name, Guid? ChapterId, string? ChapterName = null)
{
    public static IReadOnlyList<ProfileRoleDto> Of(Profile profile) =>
        [.. profile.Roles.OrderBy(r => r.Definition!.SortOrder).ThenBy(r => r.Chapter == null ? null : r.Chapter.Name)
            .Select(r => new ProfileRoleDto(r.RoleDefinitionId, r.Definition!.Name, r.ChapterId, r.Chapter?.Name))];
}

/// <summary>
/// A profile as a signed-in member sees it (L2-005). Photos are newest first. The chapter is null when there is none or
/// chapters are off (L2-141 AC1, L2-140 AC2).
/// </summary>
public record ProfileDto(
    Guid Id,
    string Name,
    Guid? ChapterId,
    string? ChapterName,
    string? Bio,
    PhotoDto? FeaturedPhoto,
    IReadOnlyList<PhotoDto> Photos,
    IReadOnlyList<ProfileRoleDto> Roles,
    bool IsOwn,
    bool CanEdit);
