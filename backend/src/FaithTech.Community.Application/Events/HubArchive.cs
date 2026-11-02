using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Application.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>A file the archive copies from storage, at its path inside the archive's folder ("slides/01.jpg").</summary>
public record HubArchiveEntry(string Path, Func<CancellationToken, Task<Stream>> Open);

/// <summary>
/// Everything a hub archive is written from (L2-197, ADR 0046): the hub as visitors see it, the time zone its times are
/// written in, when it was saved, the folder the zip holds, and the stored files its shown sections use: slides and parking
/// maps by resource id (one resource may be both), featured photos by profile id. A slide, map or photo with no entry is
/// left out.
/// </summary>
public record HubArchive(
    EventHubDto Hub,
    TimeZoneInfo TimeZone,
    DateTimeOffset SavedAt,
    string Folder,
    IReadOnlyDictionary<Guid, HubArchiveEntry> Slides,
    IReadOnlyDictionary<Guid, HubArchiveEntry> Maps,
    IReadOnlyDictionary<Guid, HubArchiveEntry> Photos);

/// <summary>Writes a hub archive as a zip: "{Folder}/index.html", then each file under "{Folder}/".</summary>
public interface IHubArchiveWriter
{
    Task WriteAsync(HubArchive archive, Stream output, CancellationToken cancellationToken = default);
}

/// <summary>A built archive: its attachment name ("{slug}-hub.zip") and bytes.</summary>
public record HubArchiveFile(string FileName, byte[] Content);

/// <summary>
/// Builds a hub's archive (L2-197, L2-198, ADR 0046). Needs <c>ManageEventHubs</c> (403). The hub is read as the hub page
/// answers visitors, so only shown, Ready sections are in it; an event or hub not in this organisation is 404. Slides, maps and
/// photos are found through the organisation's query filter, so no other organisation's blob is read. Each download is audited,
/// marked as an override when only <c>AdministerOrganisation</c> allowed it.
/// </summary>
public class HubArchiveHandler(
    IApplicationDbContext db,
    EventPermissions permissions,
    GetEventHubHandler hubs,
    IFileStorage files,
    IPhotoStorage photos,
    IHubArchiveWriter writer,
    IAuditLog audit,
    TimeProvider time)
{
    public const string UnknownTimeZone = "Choose a known time zone.";

    public async Task<(Result Result, HubArchiveFile? File)> HandleAsync(Guid eventId, string? timeZone, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanManageHubs || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return (Result.Forbidden(), null);
        }

        var zone = TimeZoneInfo.Utc;
        if (!string.IsNullOrWhiteSpace(timeZone) && !TimeZoneInfo.TryFindSystemTimeZoneById(timeZone.Trim(), out zone))
        {
            return (Result.Invalid("timeZone", UnknownTimeZone), null);
        }

        if (await hubs.PageAsync(eventId, cancellationToken) is not { } hub)
        {
            return (Result.NotFound(), null);
        }

        var folder = $"{EventFileNames.Slug(hub.Event.Title)}-hub";
        var archive = new HubArchive(
            hub, zone!, time.GetUtcNow(), folder,
            await SlidesAsync(hub, cancellationToken), await MapsAsync(hub, cancellationToken), await PhotosAsync(hub, cancellationToken));
        using var output = new MemoryStream();
        await writer.WriteAsync(archive, output, cancellationToken);

        audit.Record(actor, "event_hub.archived", "EventHub", hub.Id.ToString(), null,
            new { Override = permissions.IsHubOverride, TimeZone = zone == TimeZoneInfo.Utc ? "UTC" : zone!.Id });
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), new HubArchiveFile($"{folder}.zip", output.ToArray()));
    }

    private static T? Content<T>(EventHubDto hub, string kind)
        where T : class => hub.Sections.FirstOrDefault(s => s.Kind == kind)?.Content as T;

    /// <summary>"slides/01.jpg", "slides/02.pdf"… in slide order, for the slides the page shows.</summary>
    private async Task<Dictionary<Guid, HubArchiveEntry>> SlidesAsync(EventHubDto hub, CancellationToken cancellationToken)
    {
        var ids = Content<HubSlidesDto>(hub, "Slides")?.Slides.Select(s => s.ResourceId).Distinct().ToList() ?? [];
        return await EntriesAsync(ids, (n, extension) => $"slides/{n:00}{extension}", cancellationToken);
    }

    /// <summary>"images/parking-1.jpg"… in option order, for the options with a map.</summary>
    private async Task<Dictionary<Guid, HubArchiveEntry>> MapsAsync(EventHubDto hub, CancellationToken cancellationToken)
    {
        var ids = Content<HubParkingDto>(hub, "Parking")?.Options.Where(o => o.MapResourceId is not null)
            .Select(o => o.MapResourceId!.Value).Distinct().ToList() ?? [];
        return await EntriesAsync(ids, (n, extension) => $"images/parking-{n}{extension}", cancellationToken);
    }

    private async Task<Dictionary<Guid, HubArchiveEntry>> EntriesAsync(
        List<Guid> ids, Func<int, string, string> path, CancellationToken cancellationToken)
    {
        var found = await HubFiles.FindAsync(db.Resources, ids, cancellationToken);
        var entries = new Dictionary<Guid, HubArchiveEntry>();
        foreach (var id in ids.Where(found.ContainsKey))
        {
            var file = found[id].Resource.File!;
            if (!file.IsStored)
            {
                continue;
            }

            var blob = file.BlobName;
            entries[id] = new HubArchiveEntry(
                path(entries.Count + 1, Path.GetExtension(file.FileName).ToLowerInvariant()), ct => files.OpenReadAsync(blob, ct));
        }

        return entries;
    }

    /// <summary>"images/person-1.jpg"… for each listed member whose featured photo is stored.</summary>
    private async Task<Dictionary<Guid, HubArchiveEntry>> PhotosAsync(EventHubDto hub, CancellationToken cancellationToken)
    {
        var ids = Content<HubPeopleDto>(hub, "People")?.People.Where(p => p.ProfileId is not null)
            .Select(p => p.ProfileId!.Value).Distinct().ToList() ?? [];
        var keys = await db.Profiles.AsNoTracking().Include(p => p.Photos).Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Photos.FirstOrDefault(f => f.IsFeatured)?.BlobName, cancellationToken);
        var entries = new Dictionary<Guid, HubArchiveEntry>();
        foreach (var id in ids)
        {
            if (keys.GetValueOrDefault(id) is not { } key || await photos.ReadAsync(key, cancellationToken) is not { } image)
            {
                continue;
            }

            var extension = Path.GetExtension(key) is { Length: > 0 } ext ? ext.ToLowerInvariant() : ".jpg";
            entries[id] = new HubArchiveEntry($"images/person-{entries.Count + 1}{extension}", _ => Task.FromResult<Stream>(new MemoryStream(image.Content)));
        }

        return entries;
    }
}
