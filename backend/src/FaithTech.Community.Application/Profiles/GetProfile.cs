using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

public class GetProfileHandler(IApplicationDbContext db, ProfileAccess access, IPhotoStorage storage)
{
    /// <summary>Reads profiles only, so an unlinked private contact is never found (ADR 0003).</summary>
    public async Task<ProfileDto?> HandleAsync(Guid profileId, CancellationToken cancellationToken = default)
    {
        var profile = await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return null;
        }

        var caller = await access.CallerProfileIdAsync(cancellationToken);
        return ToDto(profile, profile.Id == caller, access.CanEdit(profile.Id, caller));
    }

    public async Task<ProfileDto?> HandleOwnAsync(CancellationToken cancellationToken = default) =>
        await access.CallerProfileIdAsync(cancellationToken) is { } own ? await HandleAsync(own, cancellationToken) : null;

    private ProfileDto ToDto(Profile profile, bool isOwn, bool canEdit)
    {
        var photos = profile.Photos
            .OrderByDescending(p => p.UploadedAt)
            .Select(p => PhotoDto.From(p, storage))
            .ToList();
        return new ProfileDto(
            profile.Id,
            profile.Name,
            profile.HomeCity,
            profile.Bio,
            photos.FirstOrDefault(p => p.IsFeatured),
            photos,
            [.. profile.Roles.OrderBy(r => r.Role).Select(r => r.Role.ToString())],
            isOwn,
            canEdit);
    }
}
