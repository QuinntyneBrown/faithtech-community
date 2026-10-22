using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Profiles;

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
/// Adds and manages a private contact's photos (L2-055 to L2-059). Only the owner and System Admin get past
/// <see cref="ContactAccess"/>; everyone else gets 404. Uses the photo pipeline's abstractions, not the profile handlers.
/// </summary>
public class ContactPhotosHandler(
    IApplicationDbContext db,
    ContactAccess access,
    IImageProcessor images,
    IPhotoStorage storage,
    PhotoLeases leases,
    TimeProvider time)
{
    public async Task<(Result Result, ContactPhotoDto? Photo)> UploadAsync(
        Guid contactId, UploadPhotoCommand command, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(contactId, cancellationToken: cancellationToken);
        if (contact is null)
        {
            return (Result.NotFound(), null);
        }

        // Hold the contact's photo lease while counting and adding (L2-059 AC3).
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

        var photo = new ContactPhoto($"contacts/{contact.Id}/{Guid.NewGuid()}{image.Extension}", altText, time.GetUtcNow());
        try
        {
            await storage.SaveAsync(photo.BlobName, image.Content, image.ContentType, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Storage is down: keep the photo and write its blob later (L2-059 AC1, ADR 0013).
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
