using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

public record UploadPhotoCommand(Stream Content, string FileName, long Length, string? AltText);

/// <summary>Validates, processes and stores a new profile photo (L2-007 AC1-4). The first photo is featured.</summary>
public class UploadPhotoHandler(
    IApplicationDbContext db,
    ProfileAccess access,
    IImageProcessor images,
    IPhotoStorage storage,
    IAuditLog audit,
    PhotoLeases leases,
    TimeProvider time,
    ICurrentOrganisation organisation)
{
    public const long MaxBytes = 5 * 1024 * 1024;
    public const int MaxAltText = 300;

    public async Task<(Result Result, PhotoDto? Photo)> HandleAsync(
        Guid profileId, UploadPhotoCommand command, CancellationToken cancellationToken = default)
    {
        var (editAccess, actor) = await access.AuthorizeEditAsync(profileId, cancellationToken);
        if (editAccess == EditAccess.Forbidden)
        {
            return (Result.Forbidden(), null);
        }

        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return (Result.NotFound(), null);
        }

        // Hold the profile's photo lease while counting and adding, so overlapping uploads cannot pass
        // the limit or both become featured.
        if (!await leases.TakeAsync(profile, cancellationToken))
        {
            return (Result.Conflict(PhotoLeases.ChangedMeanwhile), null);
        }

        // A refusal releases the lease; a success releases it in the same save as the photo. After an
        // unexpected error the context may hold unsaved changes, so the lease is left to expire instead.
        var (result, photo) = await UploadAsync(profile, command, editAccess, actor, cancellationToken);
        if (photo is null)
        {
            await leases.ReleaseAsync(profile, cancellationToken);
        }

        return (result, photo);
    }

    private async Task<(Result Result, PhotoDto? Photo)> UploadAsync(
        Profile profile, UploadPhotoCommand command, EditAccess editAccess, Guid actor, CancellationToken cancellationToken)
    {
        var profileId = profile.Id;
        if (profile.Photos.Count >= Profile.MaxPhotos)
        {
            return (Result.Invalid("File", $"That’s {Profile.MaxPhotos} photos, the most a profile can have. Remove one to add another."), null);
        }

        var altText = command.AltText?.Trim() ?? string.Empty;
        if (PhotoDescription.Check(altText) is { } altError)
        {
            return (Result.Invalid("AltText", altError), null);
        }

        if (command.Length > MaxBytes)
        {
            var megabytes = command.Length / (1024.0 * 1024.0);
            return (Result.Invalid("File", $"{command.FileName} is {megabytes:0.0} MB. Photos can be up to 5 MB — try a smaller one."), null);
        }

        var processed = await images.ProcessAsync(command.Content, command.FileName, cancellationToken);
        if (processed.Image is not { } image)
        {
            return (Result.Invalid("File", processed.Error!), null);
        }

        // Under the organisation's id, so a blob is only ever reached through its own organisation (L2-130 AC5).
        var key = $"{organisation.Id}/profiles/{profileId}/{Guid.NewGuid()}{image.Extension}";
        var photo = new ProfilePhoto(key, altText, time.GetUtcNow());
        try
        {
            await storage.SaveAsync(key, image.Content, image.ContentType, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Storage is down: keep the photo and write its blob later (L2-047 AC3).
            photo.MarkStoring();
            db.PhotoBlobTasks.Add(PhotoBlobTask.Save(photo, image.Content, image.ContentType, time.GetUtcNow()));
        }

        profile.AddPhoto(photo);
        if (editAccess == EditAccess.AdminOverride)
        {
            audit.Record(actor, "profile.photo.uploaded", "Profile", profileId.ToString(), null, new { photo.Id, photo.AltText });
        }

        profile.PhotoLease.Release();
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), PhotoDto.From(photo, storage));
    }
}

/// <summary>The alt text rule every photo shares (L2-007 AC3, AC7).</summary>
public static class PhotoDescription
{
    public static string? Check(string altText) =>
        altText.Length == 0 ? "Describe this photo."
        : altText.Length > UploadPhotoHandler.MaxAltText ? $"Use {UploadPhotoHandler.MaxAltText} characters or fewer to describe this photo."
        : null;
}
