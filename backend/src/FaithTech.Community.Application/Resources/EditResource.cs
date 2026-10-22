using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Resources;

namespace FaithTech.Community.Application.Resources;

public record EditResourceCommand(
    string? Title,
    string? Description,
    string? Type,
    IReadOnlyList<string>? Tags,
    string? Visibility,
    IReadOnlyList<Guid>? MemberIds,
    IReadOnlyList<string>? Roles,
    string? Url)
{
    public ResourceFieldsInput Fields => new(Title, Description, Type, Tags, Visibility, MemberIds, Roles);
}

/// <summary>
/// Edits a resource's details, its link and who can see it (L2-062, L2-061). Only its owner or a System Admin; the
/// admin's change is audited with before and after values (L2-064 AC1).
/// </summary>
public class EditResourceHandler(
    IApplicationDbContext db, ResourceAccess access, ResourceFieldRules rules, ResourceViews views, ShareNotifier share, IAuditLog audit, TimeProvider time)
{
    public async Task<(Result Result, ResourceDto? Resource)> HandleAsync(Guid id, EditResourceCommand command, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var resource = await access.FindAsync(id, caller, cancellationToken);
        if (resource is null)
        {
            return (Result.NotFound(), null);
        }

        if (!access.CanChange(resource, caller) || resource.IsArchived)
        {
            return (resource.IsArchived && access.CanChange(resource, caller) ? Result.Conflict("Restore it before you edit it.") : Result.Forbidden(), null);
        }

        var (fields, errors) = await rules.CheckAsync(command.Fields, titleRequired: true, cancellationToken);
        Uri? link = null;
        if (resource.IsLink && !ResourceLinks.TryParse(command.Url, out link))
        {
            errors["Url"] = [ResourceLinks.Message];
        }

        if (fields is null || errors.Count > 0)
        {
            return (ResourceResults.Invalid(errors), null);
        }

        var before = ResourceAudit.Snapshot(resource);
        var reached = await share.RecipientsAsync(resource, cancellationToken);
        resource.SetDetails(fields.Title!, fields.Description, fields.Type!.Value);
        resource.SetTags(fields.Tags);
        if (link is not null)
        {
            resource.SetLink(link);
        }

        resource.SetAudience(fields.Audience);
        resource.Touch(caller, time.GetUtcNow());
        await share.NotifyAsync(resource, caller, reached, cancellationToken);
        if (access.IsOverride(resource, caller))
        {
            audit.Record(caller, "resource.edited", nameof(Resource), resource.Id.ToString(), before, ResourceAudit.Snapshot(resource));
        }

        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.DetailAsync(resource, caller, cancellationToken));
    }
}

/// <summary>Swaps a resource's file in place (L2-062 AC2): same id and URL, the old blob and thumbnail deleted, no versions.</summary>
public class ReplaceFileHandler(
    IApplicationDbContext db, ResourceAccess access, ResourceFileStore files, ResourceViews views, IAuditLog audit, TimeProvider time)
{
    public async Task<(Result Result, ResourceDto? Resource)> HandleAsync(Guid id, IReadOnlyList<ResourceUpload> uploads, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var resource = await access.FindAsync(id, caller, cancellationToken);
        if (resource is null)
        {
            return (Result.NotFound(), null);
        }

        if (!access.CanChange(resource, caller))
        {
            return (Result.Forbidden(), null);
        }

        if (resource.IsLink || resource.IsArchived)
        {
            return (Result.Conflict(resource.IsLink ? "A link has no file to replace." : "Restore it before you replace its file."), null);
        }

        if (uploads.Count != 1)
        {
            return (Result.Invalid("Files", "Choose one file to replace it with."), null);
        }

        var upload = uploads[0];
        if (!await ResourceFileStore.AcceptsAsync(upload, cancellationToken))
        {
            return (ResourceResults.Invalid(new() { ["Files"] = [ResourceFileTypes.Refusal(upload.FileName)] }), null);
        }

        var file = await files.StoreAsync(resource.Id, upload, cancellationToken);
        var old = resource.ReplaceFile(file, caller, time.GetUtcNow());
        await files.DeleteAsync(resource.Id, [old.BlobName, old.ThumbnailBlobName], cancellationToken);
        if (access.IsOverride(resource, caller))
        {
            audit.Record(caller, "resource.file.replaced", nameof(Resource), resource.Id.ToString(), new { old.FileName }, new { file.FileName });
        }

        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.DetailAsync(resource, caller, cancellationToken));
    }
}

/// <summary>The link rule (L2-058 AC2): an absolute https URL.</summary>
public static class ResourceLinks
{
    public const string Message = "Use a link that starts with https://.";

    public static bool TryParse(string? value, out Uri? link)
    {
        link = null;
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Length > 2000
            || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || string.IsNullOrEmpty(uri.Host))
        {
            return false;
        }

        link = uri;
        return true;
    }
}
