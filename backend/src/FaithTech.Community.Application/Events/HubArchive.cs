namespace FaithTech.Community.Application.Events;

/// <summary>A file the archive copies from storage, at its path inside the archive's folder ("slides/01.jpg").</summary>
public record HubArchiveEntry(string Path, Func<CancellationToken, Task<Stream>> Open);

/// <summary>
/// Everything a hub archive is written from (L2-197, ADR 0046): the hub as visitors see it, the time zone its times are
/// written in, when it was saved, the folder the zip holds, and the stored files its shown sections use, by resource id
/// (slides and parking maps) and by profile id (featured photos). A slide, map or photo with no entry is left out.
/// </summary>
public record HubArchive(
    EventHubDto Hub,
    TimeZoneInfo TimeZone,
    DateTimeOffset SavedAt,
    string Folder,
    IReadOnlyDictionary<Guid, HubArchiveEntry> Files,
    IReadOnlyDictionary<Guid, HubArchiveEntry> Photos);

/// <summary>Writes a hub archive as a zip: "{Folder}/index.html", then each file under "{Folder}/".</summary>
public interface IHubArchiveWriter
{
    Task WriteAsync(HubArchive archive, Stream output, CancellationToken cancellationToken = default);
}
