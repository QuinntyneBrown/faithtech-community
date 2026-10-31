using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Application.Resources;
using FaithTech.Community.Domain.Notes;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

public record NoteImageUpload(string FileName, long Length, Func<Stream> Open);

public record NoteImageUploadedDto(Guid ImageId);

public record NoteImageContent(Stream Content, string ContentType);

/// <summary>
/// Images for image blocks (L2-097): JPEG, PNG or WebP up to 5 MB, checked, resized and stripped of metadata by
/// the photo processor (ADR 0001), stored behind <see cref="IFileStorage"/> and streamed under the page's
/// visibility. Only the page's owner or a System Admin uploads.
/// </summary>
public class NoteImagesHandler(IApplicationDbContext db, NoteAccess access, IImageProcessor images, IFileStorage storage, IAuditLog audit, TimeProvider time)
{
    public const string Refusal = "Use a JPEG, PNG or WebP image up to 5 MB.";
    private static readonly string[] Extensions = [".jpg", ".jpeg", ".png", ".webp"];

    /// <summary>The upload's result; <c>StorageDown</c> when the file could not be stored (503).</summary>
    public async Task<(Result Result, NoteImageUploadedDto? Image, bool StorageDown)> UploadAsync(Guid pageId, NoteImageUpload? upload, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var page = await access.FindAsync(pageId, caller, cancellationToken);
        if (page is null)
        {
            return (Result.NotFound(), null, false);
        }

        if (!access.CanChange(page, caller))
        {
            return (Result.Forbidden(), null, false);
        }

        if (page.IsArchived)
        {
            return (Result.Invalid("File", NoteFields.ArchivedMessage), null, false);
        }

        if (upload is null || upload.Length is 0 or > NoteImage.MaxBytes || !Extensions.Contains(Path.GetExtension(upload.FileName).ToLowerInvariant()))
        {
            return (Result.Invalid("File", Refusal), null, false);
        }

        await using var content = upload.Open();
        var processed = await images.ProcessAsync(content, upload.FileName, cancellationToken);
        if (processed.Image is not { } image)
        {
            return (Result.Invalid("File", Refusal), null, false);
        }

        var stored = new NoteImage(page.OrganisationId, page.Id, image.Extension.TrimStart('.'), image.ContentType, image.Content.Length, time.GetUtcNow());
        try
        {
            await storage.SaveAsync(stored.BlobName, new MemoryStream(image.Content), image.ContentType, cancellationToken);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return (Result.Ok(), null, true);
        }

        db.NoteImages.Add(stored);
        if (access.IsOverride(page, caller))
        {
            audit.Record(caller, "note.edited", nameof(NotePage), page.Id.ToString(), null, new { ImageAdded = stored.Id });
        }

        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), new NoteImageUploadedDto(stored.Id), false);
    }

    /// <summary>An image of a page the caller may open, archived pages only for their owner and System Admin.</summary>
    public async Task<NoteImageContent?> ReadAsync(Guid pageId, Guid imageId, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        if (await access.FindAsync(pageId, caller, cancellationToken) is null)
        {
            return null;
        }

        var image = await db.NoteImages.AsNoTracking().SingleOrDefaultAsync(i => i.Id == imageId && i.PageId == pageId, cancellationToken);
        return image is null ? null : new NoteImageContent(await storage.OpenReadAsync(image.BlobName, cancellationToken), image.ContentType);
    }
}
