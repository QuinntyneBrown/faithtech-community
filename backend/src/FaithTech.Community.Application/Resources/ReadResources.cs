using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Search;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

public record ListResourcesQuery(string? Q, string? Type, string? Tag, int Page = 1);

/// <summary>The Resources page (L2-055): what the caller may open, newest first, 25 a page, filtered by type, tag and text.</summary>
public class ListResourcesHandler(IApplicationDbContext db, ResourceAccess access, ResourceViews views, IFullTextSearch text)
{
    public const int PageSize = 25;

    public async Task<(Result Result, PagedResult<ResourceSummaryDto>? Page)> HandleAsync(ListResourcesQuery query, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var resources = access.Visible(db.Resources.AsNoTracking(), caller);
        if (!string.IsNullOrWhiteSpace(query.Type))
        {
            if (!Enum.TryParse<ResourceType>(query.Type, out var type) || int.TryParse(query.Type, out _))
            {
                return (Result.Invalid("type", "Choose a type from the list."), null);
            }

            resources = resources.Where(r => r.Type == type);
        }

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            var tag = query.Tag.Trim().ToLowerInvariant();
            resources = resources.Where(r => r.Tags.Any(t => t.Tag == tag));
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            resources = text.Match(resources, query.Q.Trim(), Document);
        }

        var request = new PageRequest(query.Page, PageSize);
        var total = await resources.CountAsync(cancellationToken);
        var page = resources.OrderByDescending(r => r.AddedAt).ThenBy(r => r.Id).Skip(request.Skip).Take(request.PageSize);
        var items = await views.SummariesAsync(page, caller, cancellationToken);
        return (Result.Ok(), new PagedResult<ResourceSummaryDto>(items, request.Page, request.PageSize, total));
    }

    /// <summary>The searchable text: the same fields the search vector is built from (ADR 0017).</summary>
    public static readonly System.Linq.Expressions.Expression<Func<Resource, string>> Document =
        r => r.Title + " " + (r.Description ?? "") + " " + r.TagText + " " + (r.File == null ? "" : r.File.FileName);
}

/// <summary>Tags in use on resources the caller may open, most used first, for the filter and the tag picker (L2-059 AC4).</summary>
public class ResourceTagsHandler(IApplicationDbContext db, ResourceAccess access)
{
    public async Task<IReadOnlyList<ResourceTagDto>> HandleAsync(string? q, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var tags = access.Visible(db.Resources.AsNoTracking(), caller).SelectMany(r => r.Tags.Select(t => t.Tag));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLowerInvariant();
            tags = tags.Where(t => t.Contains(term));
        }

        var counts = await tags.GroupBy(t => t).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(cancellationToken);
        return [.. counts.OrderBy(c => c.Key, StringComparer.Ordinal).Select(c => new ResourceTagDto(c.Key, c.Count))];
    }
}

/// <summary>The resource page (L2-056). A System Admin opening a resource that is not theirs and not Global is audited (L2-060 AC5).</summary>
public class GetResourceHandler(IApplicationDbContext db, ResourceAccess access, ResourceViews views, IAuditLog audit)
{
    public async Task<ResourceDto?> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var resource = await access.FindAsync(id, caller, cancellationToken);
        if (resource is null)
        {
            return null;
        }

        if (ResourceAudit.IsPrivileged(access, resource, caller))
        {
            audit.Record(caller, "resource.opened", nameof(Resource), resource.Id.ToString(), null, new { resource.Title, Visibility = resource.Visibility.ToString() });
            await db.SaveChangesAsync(cancellationToken);
        }

        return await views.DetailAsync(resource, caller, cancellationToken);
    }
}

public record ResourceContent(Stream Content, string ContentType, string? FileName);

/// <summary>Downloads and thumbnails, streamed through the API under the same visibility rule (ADR 0017).</summary>
public class DownloadResourceHandler(IApplicationDbContext db, ResourceAccess access, IFileStorage storage, IAuditLog audit)
{
    public const string StillStoring = "This file is still uploading. Try again in a minute.";

    public async Task<(Result Result, ResourceContent? Content)> FileAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var resource = await access.FindAsync(id, caller, cancellationToken);
        if (resource?.File is not { } file)
        {
            return (Result.NotFound(), null);
        }

        if (!file.IsStored)
        {
            return (Result.Conflict(StillStoring), null);
        }

        if (ResourceAudit.IsPrivileged(access, resource, caller))
        {
            audit.Record(caller, "resource.downloaded", nameof(Resource), resource.Id.ToString(), null, new { file.FileName });
            await db.SaveChangesAsync(cancellationToken);
        }

        return (Result.Ok(), new ResourceContent(await storage.OpenReadAsync(file.BlobName, cancellationToken), file.ContentType, file.FileName));
    }

    public async Task<(Result Result, ResourceContent? Content)> ThumbnailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var resource = await access.FindAsync(id, caller, cancellationToken);
        if (resource?.File is not { ThumbnailBlobName: { } key } file)
        {
            return (Result.NotFound(), null);
        }

        return file.IsStored
            ? (Result.Ok(), new ResourceContent(await storage.OpenReadAsync(key, cancellationToken), "image/png", null))
            : (Result.Conflict(StillStoring), null);
    }
}

internal static class ResourceAudit
{
    /// <summary>A System Admin reaching a resource only their role lets them see.</summary>
    public static bool IsPrivileged(ResourceAccess access, Resource resource, Guid caller) =>
        access.IsOverride(resource, caller) && (resource.Visibility != ResourceVisibility.Global || resource.IsArchived);

    public static object Snapshot(Resource r) => new
    {
        r.Title,
        r.Description,
        Type = r.Type.ToString(),
        Tags = r.Tags.Select(t => t.Tag).ToList(),
        Visibility = r.Visibility.ToString(),
        Members = r.SharedMembers.Select(m => m.ProfileId).ToList(),
        Roles = r.SharedRoles.Select(x => x.Role.ToString()).ToList(),
        r.File?.FileName,
        r.LinkUrl,
        r.OwnerId,
    };
}
