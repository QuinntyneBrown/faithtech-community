using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Contacts;

/// <summary>
/// A contact photo. <c>Url</c> is the authenticated API path of its image, never a storage link (ADR 0017),
/// and null while <c>IsStored</c> is false.
/// </summary>
public record ContactPhotoDto(Guid Id, string? Url, string AltText, bool IsFeatured, DateTimeOffset UploadedAt, bool IsStored)
{
    public static ContactPhotoDto From(Guid contactId, ContactPhoto photo) =>
        new(photo.Id, ImageUrl(contactId, photo), photo.AltText, photo.IsFeatured, photo.UploadedAt, photo.IsStored);

    public static string? ImageUrl(Guid contactId, ContactPhoto photo) =>
        photo.IsStored ? $"/api/contacts/{contactId}/photos/{photo.Id}/image" : null;
}

/// <summary>
/// Adds and manages a private contact's photos (L2-067 to L2-071). Only the owner and System Admin get past
/// <see cref="ContactAccess"/>; everyone else gets 404. Uses the photo pipeline's abstractions, not the profile handlers.
/// </summary>
public class ContactPhotosHandler(
    IApplicationDbContext db,
    ContactAccess access,
    IImageProcessor images,
    IPhotoStorage storage,
    PhotoLeases leases,
    TimeProvider time,
    ICurrentOrganisation organisation)
{
    public async Task<(Result Result, ContactPhotoDto? Photo)> UploadAsync(
        Guid contactId, UploadPhotoCommand command, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(contactId, cancellationToken: cancellationToken);
        if (contact is null)
        {
            return (Result.NotFound(), null);
        }

        // Hold the contact's photo lease while counting and adding (L2-071 AC3).
        if (!await leases.TakeAsync(contact.PhotoLease, cancellationToken))
        {
            return (Result.Conflict(PhotoLeases.ChangedMeanwhile), null);
        }

        // A refusal releases the lease; a success releases it in the same save as the photo.
        var (result, photo) = await AddAsync(contact, command, kind, actor, cancellationToken);
        if (photo is null)
        {
            await leases.ReleaseAsync(contact.PhotoLease, cancellationToken);
        }

        return (result, photo);
    }

    /// <summary>
    /// The image of a stored photo for the owner or a System Admin (audited); null for anyone else, an unknown photo or
    /// one still storing, so a shared URL never shows the image to someone else (L2-070 AC1-4).
    /// </summary>
    public async Task<StoredImage?> ReadImageAsync(Guid contactId, Guid photoId, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(contactId, cancellationToken: cancellationToken);
        var photo = contact?.Photos.SingleOrDefault(p => p.Id == photoId);
        if (contact is null || photo is not { IsStored: true })
        {
            return null;
        }

        if (kind == ContactAccessKind.AdminOverride)
        {
            access.AuditOverride(kind, actor, contact, "contact.photo-viewed", after: new { contact.Name, Photo = photo.Id });
            await db.SaveChangesAsync(cancellationToken);
        }

        return await storage.ReadAsync(photo.BlobName, cancellationToken);
    }

    /// <summary>Changes a photo's description (L2-068 AC4).</summary>
    public async Task<Result> DescribeAsync(Guid contactId, Guid photoId, DescribePhotoCommand command, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(contactId, cancellationToken: cancellationToken);
        var photo = contact?.Photos.SingleOrDefault(p => p.Id == photoId);
        if (contact is null || photo is null)
        {
            return Result.NotFound();
        }

        var altText = command.AltText?.Trim() ?? string.Empty;
        if (PhotoDescription.Check(altText) is { } error)
        {
            return Result.Invalid("AltText", error);
        }

        var before = new { Photo = photo.Id, photo.AltText };
        photo.Describe(altText);
        access.AuditOverride(kind, actor, contact, "contact.photo-described", before, new { Photo = photo.Id, photo.AltText });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    /// <summary>Makes one photo the contact's only featured photo (L2-068 AC3).</summary>
    public async Task<Result> FeatureAsync(Guid contactId, Guid photoId, CancellationToken cancellationToken = default)
    {
        var (refused, contact, photo, kind, actor) = await FindLeasedAsync(contactId, photoId, cancellationToken);
        if (refused is not null)
        {
            return refused;
        }

        var before = contact.Photos.SingleOrDefault(p => p.IsFeatured)?.Id;
        contact.Feature(photo.Id);
        access.AuditOverride(kind, actor, contact, "contact.photo-featured", new { Featured = before }, new { Featured = photo.Id });
        contact.PhotoLease.Release();
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    /// <summary>Removes a photo and its blob; the newest remaining photo takes over as featured (L2-068 AC5, AC6).</summary>
    public async Task<Result> DeleteAsync(Guid contactId, Guid photoId, CancellationToken cancellationToken = default)
    {
        var (refused, contact, photo, kind, actor) = await FindLeasedAsync(contactId, photoId, cancellationToken);
        if (refused is not null)
        {
            return refused;
        }

        contact.RemovePhoto(photo.Id);
        contact.PhotoLease.Release();
        access.AuditOverride(kind, actor, contact, "contact.photo-deleted", new { Photo = photo.Id, photo.AltText });
        await db.SaveChangesAsync(cancellationToken);
        await DeleteBlobsAsync(db, storage, time, [photo], cancellationToken);
        return Result.Ok();
    }

    /// <summary>
    /// Deletes the blobs of photos whose rows are already gone: a photo still storing drops its queued write, and a
    /// delete that fails is queued for retry, so a removed photo never leaves an orphan blob (ADR 0002, ADR 0013).
    /// </summary>
    internal static async Task DeleteBlobsAsync(
        IApplicationDbContext db, IPhotoStorage storage, TimeProvider time, IReadOnlyCollection<ContactPhoto> photos, CancellationToken cancellationToken)
    {
        var storing = photos.Where(p => !p.IsStored).Select(p => p.Id).ToList();
        if (storing.Count > 0)
        {
            db.PhotoBlobTasks.RemoveRange(await db.PhotoBlobTasks.Where(t => storing.Contains(t.PhotoId)).ToListAsync(cancellationToken));
        }

        foreach (var photo in photos.Where(p => p.IsStored))
        {
            try
            {
                await storage.DeleteAsync(photo.BlobName, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                db.PhotoBlobTasks.Add(PhotoBlobTask.Delete(photo.Id, photo.BlobName, time.GetUtcNow()));
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Loads a photo the caller may change and takes the contact's photo lease, or the result that refuses it.</summary>
    private async Task<(Result? Refused, Contact Contact, ContactPhoto Photo, ContactAccessKind Kind, Guid Actor)> FindLeasedAsync(
        Guid contactId, Guid photoId, CancellationToken cancellationToken)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(contactId, cancellationToken: cancellationToken);
        var photo = contact?.Photos.SingleOrDefault(p => p.Id == photoId);
        if (contact is null || photo is null)
        {
            return (Result.NotFound(), null!, null!, kind, actor);
        }

        return await leases.TakeAsync(contact.PhotoLease, cancellationToken)
            ? (null, contact, photo, kind, actor)
            : (Result.Conflict(PhotoLeases.ChangedMeanwhile), null!, null!, kind, actor);
    }

    private async Task<(Result Result, ContactPhotoDto? Photo)> AddAsync(
        Contact contact, UploadPhotoCommand command, ContactAccessKind kind, Guid actor, CancellationToken cancellationToken)
    {
        if (contact.Photos.Count >= Contact.MaxPhotos)
        {
            return (Result.Invalid("File", $"That’s {Contact.MaxPhotos} photos, the most a contact can have. Remove one to add another."), null);
        }

        var altText = command.AltText?.Trim() ?? string.Empty;
        if (PhotoDescription.Check(altText) is { } altError)
        {
            return (Result.Invalid("AltText", altError), null);
        }

        if (command.Length > UploadPhotoHandler.MaxBytes)
        {
            var megabytes = command.Length / (1024.0 * 1024.0);
            return (Result.Invalid("File", $"{command.FileName} is {megabytes:0.0} MB. Photos can be up to 5 MB — try a smaller one."), null);
        }

        var processed = await images.ProcessAsync(command.Content, command.FileName, cancellationToken);
        if (processed.Image is not { } image)
        {
            return (Result.Invalid("File", processed.Error!), null);
        }

        var photo = new ContactPhoto($"{organisation.Id}/contacts/{contact.Id}/{Guid.NewGuid()}{image.Extension}", altText, time.GetUtcNow());
        try
        {
            await storage.SaveAsync(photo.BlobName, image.Content, image.ContentType, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Storage is down: keep the photo and write its blob later (L2-071 AC1, ADR 0013).
            photo.MarkStoring();
            db.PhotoBlobTasks.Add(PhotoBlobTask.Save(photo.Id, photo.BlobName, image.Content, image.ContentType, time.GetUtcNow()));
        }

        contact.AddPhoto(photo);
        access.AuditOverride(kind, actor, contact, "contact.photo-added", after: new { contact.Name, Photo = photo.Id, photo.AltText });
        contact.PhotoLease.Release();
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), ContactPhotoDto.From(contact.Id, photo));
    }
}
