using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Profiles;

public record DescribePhotoCommand(string? AltText);

/// <summary>Loads a photo the caller may change, or the result that refuses it (ADR 0004).</summary>
public class PhotoAccess(IApplicationDbContext db, ProfileAccess access)
{
    public async Task<(Result? Refused, Profile Profile, ProfilePhoto Photo, EditAccess Access, Guid Actor)> FindAsync(
        Guid profileId, Guid photoId, CancellationToken cancellationToken)
    {
        var (editAccess, actor) = await access.AuthorizeEditAsync(profileId, cancellationToken);
        if (editAccess == EditAccess.Forbidden)
        {
            return (Result.Forbidden(), null!, null!, editAccess, actor);
        }

        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        var photo = profile?.Photos.SingleOrDefault(p => p.Id == photoId);
        return photo is null
            ? (Result.NotFound(), null!, null!, editAccess, actor)
            : (null, profile!, photo, editAccess, actor);
    }
}

/// <summary>Changes a photo's alt text (L2-007 AC7).</summary>
public class DescribePhotoHandler(IApplicationDbContext db, PhotoAccess photos, IAuditLog audit)
{
    public async Task<Result> HandleAsync(Guid profileId, Guid photoId, DescribePhotoCommand command, CancellationToken cancellationToken = default)
    {
        var (refused, _, photo, access, actor) = await photos.FindAsync(profileId, photoId, cancellationToken);
        if (refused is not null)
        {
            return refused;
        }

        var altText = command.AltText?.Trim() ?? string.Empty;
        if (PhotoDescription.Check(altText) is { } error)
        {
            return Result.Invalid("AltText", error);
        }

        var before = new { photo.Id, photo.AltText };
        photo.Describe(altText);
        if (access == EditAccess.AdminOverride)
        {
            audit.Record(actor, "profile.photo.described", "Profile", profileId.ToString(), before, new { photo.Id, photo.AltText });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}

/// <summary>Makes one photo the only featured photo (L2-007 AC5).</summary>
public class SetFeaturedPhotoHandler(IApplicationDbContext db, PhotoAccess photos, IAuditLog audit)
{
    public async Task<Result> HandleAsync(Guid profileId, Guid photoId, CancellationToken cancellationToken = default)
    {
        var (refused, profile, photo, access, actor) = await photos.FindAsync(profileId, photoId, cancellationToken);
        if (refused is not null)
        {
            return refused;
        }

        var before = profile.Photos.SingleOrDefault(p => p.IsFeatured)?.Id;
        profile.Feature(photo.Id);
        if (access == EditAccess.AdminOverride)
        {
            audit.Record(actor, "profile.photo.featured", "Profile", profileId.ToString(), new { Featured = before, Photo = photo.Id }, new { Featured = photo.Id });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}

/// <summary>Removes a photo and its blob; the newest remaining photo takes over as featured (L2-007 AC6).</summary>
public class DeletePhotoHandler(IApplicationDbContext db, PhotoAccess photos, IPhotoStorage storage, IAuditLog audit, TimeProvider time)
{
    public async Task<Result> HandleAsync(Guid profileId, Guid photoId, CancellationToken cancellationToken = default)
    {
        var (refused, profile, photo, access, actor) = await photos.FindAsync(profileId, photoId, cancellationToken);
        if (refused is not null)
        {
            return refused;
        }

        profile.RemovePhoto(photo.Id);
        if (access == EditAccess.AdminOverride)
        {
            audit.Record(actor, "profile.photo.deleted", "Profile", profileId.ToString(), new { photo.Id, photo.AltText }, null);
        }

        if (!photo.IsStored)
        {
            // Its blob was never written: drop the queued write instead of deleting anything.
            db.PhotoBlobTasks.RemoveRange(await db.PhotoBlobTasks.Where(t => t.PhotoId == photo.Id).ToListAsync(cancellationToken));
            await db.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }

        await db.SaveChangesAsync(cancellationToken);
        // After the save: a failed delete never leaves a profile pointing at a missing blob (ADR 0002),
        // and the delete is queued for retry rather than left as an orphan (L2-047 AC3).
        try
        {
            await storage.DeleteAsync(photo.BlobName, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            db.PhotoBlobTasks.Add(PhotoBlobTask.Delete(photo, time.GetUtcNow()));
            await db.SaveChangesAsync(cancellationToken);
        }

        return Result.Ok();
    }
}
