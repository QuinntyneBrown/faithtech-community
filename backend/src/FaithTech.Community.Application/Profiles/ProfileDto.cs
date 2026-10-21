namespace FaithTech.Community.Application.Profiles;

public record PhotoDto(Guid Id, string Url, string AltText, bool IsFeatured, DateTimeOffset UploadedAt);

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
