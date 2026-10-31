using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FaithTech.Community.Application.Resources;

/// <summary>An uploaded file: its name and length, and a way to read it (more than once: to check, store and retry).</summary>
public record ResourceUpload(string FileName, long Length, Func<Stream> Open);

public record AddResourcesCommand(IReadOnlyList<ResourceUpload> Files, ResourceFieldsInput Fields, string? Url);

/// <summary>
/// Adds one resource per uploaded file, 1 to 20 a request (L2-057). Every file is checked before any is added, so a
/// refused file adds nothing. Titles and types come from each file unless one file carries its own.
/// </summary>
public class AddResourcesHandler(
    IApplicationDbContext db,
    ResourceAccess access,
    ResourceFieldRules rules,
    ResourceFileStore files,
    ResourceViews views,
    ShareNotifier share,
    TimeProvider time)
{
    public async Task<(Result Result, IReadOnlyList<ResourceDto>? Added)> HandleAsync(AddResourcesCommand command, CancellationToken cancellationToken = default)
    {
        if (await ContributorAsync(cancellationToken) is { } refusal)
        {
            return (refusal, null);
        }

        if (command.Url is not null)
        {
            return (Result.Invalid("Url", "Add a file or a link, not both."), null);
        }

        if (command.Files.Count == 0)
        {
            return (Result.Invalid("Files", "Choose at least one file."), null);
        }

        if (command.Files.Count > ResourceFileTypes.MaxFiles)
        {
            return (Result.Invalid("Files", $"Add up to {ResourceFileTypes.MaxFiles} files at a time."), null);
        }

        var refused = new List<string>();
        foreach (var file in command.Files)
        {
            if (!await ResourceFileStore.AcceptsAsync(file, cancellationToken))
            {
                refused.Add(ResourceFileTypes.Refusal(file.FileName));
            }
        }

        if (refused.Count > 0)
        {
            return (ResourceResults.Invalid(new() { ["Files"] = [.. refused] }), null);
        }

        var (fields, errors) = await rules.CheckAsync(command.Fields, titleRequired: false, cancellationToken);
        if (fields is null)
        {
            return (ResourceResults.Invalid(errors), null);
        }

        var caller = await access.CallerAsync(cancellationToken);
        var ownerRole = await OwnerRoleAsync(caller, cancellationToken);
        var now = time.GetUtcNow();
        var single = command.Files.Count == 1;
        var added = new List<Resource>();
        foreach (var upload in command.Files)
        {
            var id = Guid.NewGuid();
            var file = await files.StoreAsync(id, upload, cancellationToken);
            var title = single && fields.Title is not null ? fields.Title : TitleFrom(upload.FileName);
            var type = single && fields.Type is { } chosen ? chosen : ResourceFileTypes.GuessType(upload.FileName);
            var resource = Resource.ForFile(id, title, fields.Description, type, caller, file, now);
            resource.SetOwner(caller, ownerRole);
            resource.SetTags(fields.Tags);
            resource.SetAudience(fields.Audience);
            db.Resources.Add(resource);
            added.Add(resource);
        }

        await share.NotifyAsync(added, caller, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        var dtos = new List<ResourceDto>();
        foreach (var resource in added)
        {
            dtos.Add(await views.DetailAsync(resource, caller, cancellationToken));
        }

        return (Result.Ok(), dtos);
    }

    /// <summary>Refuses a caller who may not add resources or whose email is not verified (L2-057 AC2, AC3).</summary>
    public async Task<Result?> ContributorAsync(CancellationToken cancellationToken)
    {
        if (!access.CanContribute)
        {
            return Result.Forbidden();
        }

        var caller = await access.CallerAsync(cancellationToken);
        var verified = await db.Users.Where(u => db.Profiles.Any(p => p.Id == caller && p.UserId == u.Id)).Select(u => u.EmailConfirmed).SingleOrDefaultAsync(cancellationToken);
        return verified ? null : Result.Forbidden("Verify your email before adding resources.");
    }

    public async Task<Role?> OwnerRoleAsync(Guid profileId, CancellationToken cancellationToken)
    {
        // The owner's first held role that adds resources, AdministerOrganisation standing in for it.
        var key = await db.Profiles.Where(p => p.Id == profileId)
            .SelectMany(p => p.Roles.Select(r => r.Definition!))
            .Where(d => d.ArchivedAtUtc == null
                && (d.Capabilities.Contains(Capability.AddResources) || d.Capabilities.Contains(Capability.AdministerOrganisation)))
            .OrderBy(d => d.SortOrder)
            .Select(d => d.Key)
            .FirstOrDefaultAsync(cancellationToken);
        return key is null ? null : LegacyRoles.Parse([key]).Select(r => (Role?)r).FirstOrDefault();
    }

    private static string TitleFrom(string fileName)
    {
        var title = Path.GetFileNameWithoutExtension(fileName).Trim();
        title = title.Length == 0 ? fileName : title;
        return title.Length > Resource.MaxTitle ? title[..Resource.MaxTitle].TrimEnd() : title;
    }
}

public record AddLinkCommand(
    string? Url, string? Title, string? Description, string? Type, IReadOnlyList<string>? Tags, string? Visibility,
    IReadOnlyList<Guid>? MemberIds, IReadOnlyList<string>? Roles)
{
    public ResourceFieldsInput Fields => new(Title, Description, Type, Tags, Visibility, MemberIds, Roles);
}

/// <summary>Adds one https link (L2-058). The URL is never fetched; the owner is shown so a dead link has someone to ask.</summary>
public class AddLinkHandler(
    IApplicationDbContext db, AddResourcesHandler contributors, ResourceAccess access, ResourceFieldRules rules, ResourceViews views,
    ShareNotifier share, TimeProvider time)
{
    public async Task<(Result Result, ResourceDto? Added)> HandleAsync(AddLinkCommand command, CancellationToken cancellationToken = default)
    {
        if (await contributors.ContributorAsync(cancellationToken) is { } refusal)
        {
            return (refusal, null);
        }

        var (fields, errors) = await rules.CheckAsync(command.Fields, titleRequired: true, cancellationToken);
        if (!ResourceLinks.TryParse(command.Url, out var link))
        {
            errors["Url"] = [ResourceLinks.Message];
        }

        if (fields is null || errors.Count > 0)
        {
            return (ResourceResults.Invalid(errors), null);
        }

        var caller = await access.CallerAsync(cancellationToken);
        var resource = Resource.ForLink(fields.Title!, fields.Description, fields.Type!.Value, caller, link!, time.GetUtcNow());
        resource.SetOwner(caller, await contributors.OwnerRoleAsync(caller, cancellationToken));
        resource.SetTags(fields.Tags);
        resource.SetAudience(fields.Audience);
        db.Resources.Add(resource);
        await share.NotifyAsync([resource], caller, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.DetailAsync(resource, caller, cancellationToken));
    }
}

/// <summary>
/// Stores an upload's blob and thumbnail. When storage is down the file is kept in a retry task and the resource is
/// saved as storing (ADR 0013, ADR 0017).
/// </summary>
public class ResourceFileStore(
    IApplicationDbContext db,
    IFileStorage storage,
    Profiles.IImageProcessor images,
    TimeProvider time,
    ILogger<ResourceFileStore> logger,
    ICurrentOrganisation organisation)
{
    public const int ThumbnailEdge = 480;

    public static async Task<bool> AcceptsAsync(ResourceUpload file, CancellationToken cancellationToken)
    {
        if (!ResourceFileTypes.IsAllowed(file.FileName) || file.Length is <= 0 or > ResourceFileTypes.MaxBytes)
        {
            return false;
        }

        await using var stream = file.Open();
        var buffer = new byte[Math.Min(ResourceFileTypes.SniffLength, file.Length)];
        var read = await stream.ReadAtLeastAsync(buffer, buffer.Length, throwOnEndOfStream: false, cancellationToken);
        return ResourceFileTypes.Accepts(file.FileName, file.Length, buffer[..read]);
    }

    public async Task<ResourceFile> StoreAsync(Guid resourceId, ResourceUpload upload, CancellationToken cancellationToken)
    {
        var blobId = Guid.NewGuid();
        var extension = ResourceFileTypes.ExtensionOf(upload.FileName);
        var key = $"{organisation.Id}/resources/{resourceId}/{blobId}.{extension}";
        var contentType = ResourceFileTypes.ContentTypeOf(upload.FileName);
        var thumbnail = ResourceFileTypes.HasThumbnail(upload.FileName) ? await ThumbnailAsync(upload, cancellationToken) : null;
        var thumbnailKey = thumbnail is null ? null : $"{organisation.Id}/resources/{resourceId}/{blobId}-thumb.png";
        var file = new ResourceFile(upload.FileName, upload.Length, contentType, key, thumbnailKey);
        try
        {
            await using var content = upload.Open();
            await storage.SaveAsync(key, content, contentType, cancellationToken);
            if (thumbnail is not null)
            {
                await storage.SaveAsync(thumbnailKey!, new MemoryStream(thumbnail), "image/png", cancellationToken);
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning("Resource blob write for {ResourceId} failed: {ErrorType}", resourceId, exception.GetType().Name);
            file.MarkStoring();
            await using var content = upload.Open();
            using var buffer = new MemoryStream();
            await content.CopyToAsync(buffer, cancellationToken);
            db.ResourceBlobTasks.Add(ResourceBlobTask.Save(resourceId, key, buffer.ToArray(), contentType, time.GetUtcNow()));
            if (thumbnail is not null)
            {
                db.ResourceBlobTasks.Add(ResourceBlobTask.Save(resourceId, thumbnailKey!, thumbnail, "image/png", time.GetUtcNow()));
            }
        }

        return file;
    }

    /// <summary>Deletes blobs that are no longer used, queueing the delete when storage is down.</summary>
    public async Task DeleteAsync(Guid resourceId, IEnumerable<string?> keys, CancellationToken cancellationToken)
    {
        foreach (var key in keys.OfType<string>())
        {
            // A blob still waiting to be written is simply never written.
            var pending = await db.ResourceBlobTasks.Where(t => t.BlobName == key && t.Work == ResourceBlobWork.Save).ToListAsync(cancellationToken);
            if (pending.Count > 0)
            {
                foreach (var task in pending)
                {
                    db.ResourceBlobTasks.Remove(task);
                }

                continue;
            }

            try
            {
                await storage.DeleteAsync(key, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning("Resource blob delete for {ResourceId} failed: {ErrorType}", resourceId, exception.GetType().Name);
                db.ResourceBlobTasks.Add(ResourceBlobTask.Delete(resourceId, key, time.GetUtcNow()));
            }
        }
    }

    private async Task<byte[]?> ThumbnailAsync(ResourceUpload upload, CancellationToken cancellationToken)
    {
        await using var content = upload.Open();
        return await images.ThumbnailAsync(content, ThumbnailEdge, cancellationToken);
    }
}
