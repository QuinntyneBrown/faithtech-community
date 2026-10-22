using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

/// <summary>
/// Deletes resources archived 30 or more days ago (L2-063 AC7): the file and thumbnail blobs, then the record with
/// its tags and audience. Audit entries about them stay. Safe to run again; a blob delete that fails is retried.
/// </summary>
public class PurgeArchivedResourcesHandler(IApplicationDbContext db, ResourceFileStore files, TimeProvider time)
{
    private const int BatchSize = 50;

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var cutoff = time.GetUtcNow() - Domain.Resources.Resource.PurgeAfter;
        var due = await db.Resources.Where(r => r.ArchivedAt != null && r.ArchivedAt <= cutoff).Take(BatchSize).ToListAsync(cancellationToken);
        foreach (var resource in due)
        {
            await files.DeleteAsync(resource.Id, [resource.File?.BlobName, resource.File?.ThumbnailBlobName], cancellationToken);
            db.Resources.Remove(resource);
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
