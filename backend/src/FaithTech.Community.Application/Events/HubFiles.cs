using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Resources;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>A partner as the hub page shows it, read from Partners on every request (L2-175 AC3, ADR 0042).</summary>
public record HubPartnerDto(Guid Id, string Name, string? Offering, string? Website);

public record HubPartnersDto(IReadOnlyList<HubPartnerDto> Partners, string? Meet);

/// <summary>A parking option with its map's title; a map no longer in Resources drops out (L2-173 AC3).</summary>
public record HubParkingOptionDto(string? Title, string? Notes, Guid? MapResourceId, string? MapTitle);

public record HubParkingDto(string? Note, IReadOnlyList<HubParkingOptionDto> Options);

/// <summary>A slide: its resource, title and whether it is an Image or a Pdf (L2-182 AC2).</summary>
public record HubSlideDto(Guid ResourceId, string Title, string Kind);

public record HubSlidesDto(IReadOnlyList<HubSlideDto> Slides);

/// <summary>Which Resources a hub may show: maps are images, slides are images or PDFs (ADR 0042).</summary>
public static class HubFiles
{
    public const string Image = "Image";

    public const string Pdf = "Pdf";

    /// <summary>"Image", "Pdf" or null for a stored file of another kind.</summary>
    public static string? KindOf(ResourceFile? file) => file is null
        ? null
        : ResourceFileTypes.HasThumbnail(file.FileName) ? Image : file.Extension.Equals("pdf", StringComparison.OrdinalIgnoreCase) ? Pdf : null;

    /// <summary>Active file resources among the ids, by id, with their kind.</summary>
    public static async Task<Dictionary<Guid, (Resource Resource, string Kind)>> FindAsync(
        IQueryable<Resource> resources, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        var found = await resources.AsNoTracking().Include(r => r.File)
            .Where(r => ids.Contains(r.Id) && r.ArchivedAt == null && r.File != null).ToListAsync(cancellationToken);
        return found.Select(r => (r, Kind: KindOf(r.File))).Where(x => x.Kind is not null)
            .ToDictionary(x => x.r.Id, x => (x.r, x.Kind!));
    }
}

/// <summary>
/// Serves a hub's maps and slides (L2-182 AC3, ADR 0042): only a resource a shown section names, to exactly the callers who
/// may see the hub page. Anything else is 404.
/// </summary>
public class HubFileHandler(
    IApplicationDbContext db,
    EventPermissions permissions,
    ICurrentUser user,
    ICurrentOrganisation organisation,
    IFileStorage storage)
{
    public async Task<ResourceContent?> FileAsync(Guid eventId, Guid resourceId, CancellationToken cancellationToken = default) =>
        await FindAsync(eventId, resourceId, cancellationToken) is { IsStored: true } file
            ? new ResourceContent(await storage.OpenReadAsync(file.BlobName, cancellationToken), file.ContentType, file.FileName)
            : null;

    public async Task<ResourceContent?> ThumbnailAsync(Guid eventId, Guid resourceId, CancellationToken cancellationToken = default) =>
        await FindAsync(eventId, resourceId, cancellationToken) is { IsStored: true, ThumbnailBlobName: { } key }
            ? new ResourceContent(await storage.OpenReadAsync(key, cancellationToken), "image/png", null)
            : null;

    private async Task<ResourceFile?> FindAsync(Guid eventId, Guid resourceId, CancellationToken cancellationToken)
    {
        var e = await db.Events.AsNoTracking().SingleOrDefaultAsync(x => x.Id == eventId, cancellationToken);
        var hub = e is null
            ? null
            : await db.EventHubs.AsNoTracking().Include(h => h.Sections).SingleOrDefaultAsync(h => h.EventId == eventId, cancellationToken);
        if (e is null || hub is null)
        {
            return null;
        }

        var readable = permissions.CanManageHubs
            || (hub.Status == EventHubStatus.Published && (e.Visibility == EventVisibility.Public || user.IsMember));
        if (!readable)
        {
            return null;
        }

        var org = await db.Organisations.AsNoTracking().SingleAsync(o => o.Id == organisation.Id, cancellationToken);
        var named = hub.Sections.Where(s => HubContent.State(s, e, org) == "Ready")
            .Any(s => HubContent.ResourceIds(s.Kind, s.Content).Contains(resourceId));
        if (!named)
        {
            return null;
        }

        var found = await HubFiles.FindAsync(db.Resources, [resourceId], cancellationToken);
        return found.TryGetValue(resourceId, out var x) ? x.Resource.File : null;
    }
}
