using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FaithTech.Community.Application.Profiles;

/// <summary>
/// Retries blob work that failed while storage was down (L2-047 AC3, L2-059), for profile and contact photos. A write makes its photo
/// available; a delete removes the blob of a photo that is already gone. Each task is keyed to one
/// photo and one blob name, so a retry never creates another photo.
/// </summary>
public class PhotoStorageRetryHandler(
    IApplicationDbContext db, IPhotoStorage storage, TimeProvider time, ILogger<PhotoStorageRetryHandler> logger)
{
    private const int BatchSize = 20;

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var due = await db.PhotoBlobTasks
            .Where(t => t.NextAttemptAt <= now)
            .OrderBy(t => t.NextAttemptAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var task in due)
        {
            try
            {
                if (task.Work == PhotoBlobWork.Save)
                {
                    await SaveAsync(task, cancellationToken);
                }
                else
                {
                    await storage.DeleteAsync(task.BlobName, cancellationToken);
                }

                db.PhotoBlobTasks.Remove(task);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                task.Failed(time.GetUtcNow());
                logger.LogWarning("Photo blob {Work} for {PhotoId} failed on attempt {Attempts}: {ErrorType}",
                    task.Work, task.PhotoId, task.Attempts, exception.GetType().Name);
            }

            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task SaveAsync(PhotoBlobTask task, CancellationToken cancellationToken)
    {
        // The task names a profile photo or a contact photo (ADR 0017).
        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Photos.Any(photo => photo.Id == task.PhotoId), cancellationToken);
        var contact = profile is null
            ? await db.Contacts.SingleOrDefaultAsync(c => c.Photos.Any(photo => photo.Id == task.PhotoId), cancellationToken)
            : null;
        Action? markStored = profile is not null ? profile.Photos.Single(p => p.Id == task.PhotoId).MarkStored
            : contact is not null ? contact.Photos.Single(p => p.Id == task.PhotoId).MarkStored
            : null;
        if (markStored is null)
        {
            // Deleted before its blob was written: nothing to store.
            return;
        }

        await storage.SaveAsync(task.BlobName, task.Content!, task.ContentType!, cancellationToken);
        markStored();
    }
}
