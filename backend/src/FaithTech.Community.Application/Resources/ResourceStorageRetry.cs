using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FaithTech.Community.Application.Resources;

/// <summary>Retries resource blob work that failed while storage was down, as photos do (ADR 0013, ADR 0017).</summary>
public class ResourceStorageRetryHandler(
    IApplicationDbContext db, IFileStorage storage, TimeProvider time, ILogger<ResourceStorageRetryHandler> logger)
{
    private const int BatchSize = 10;

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var due = await db.ResourceBlobTasks
            .Where(t => t.NextAttemptAt <= now)
            .OrderBy(t => t.NextAttemptAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var task in due)
        {
            try
            {
                if (task.Work == ResourceBlobWork.Save)
                {
                    await storage.SaveAsync(task.BlobName, new MemoryStream(task.Content!), task.ContentType!, cancellationToken);
                    await MarkStoredAsync(task, cancellationToken);
                }
                else
                {
                    await storage.DeleteAsync(task.BlobName, cancellationToken);
                }

                db.ResourceBlobTasks.Remove(task);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                task.Failed(time.GetUtcNow());
                logger.LogWarning("Resource blob {Work} for {ResourceId} failed on attempt {Attempts}: {ErrorType}",
                    task.Work, task.ResourceId, task.Attempts, exception.GetType().Name);
            }

            await db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>The resource is stored once neither its file nor its thumbnail waits any longer.</summary>
    private async Task MarkStoredAsync(ResourceBlobTask task, CancellationToken cancellationToken)
    {
        var resource = await db.Resources.SingleOrDefaultAsync(r => r.Id == task.ResourceId, cancellationToken);
        var waiting = await db.ResourceBlobTasks.CountAsync(
            t => t.ResourceId == task.ResourceId && t.Work == ResourceBlobWork.Save && t.Id != task.Id, cancellationToken);
        if (resource?.File is { } file && waiting == 0)
        {
            file.MarkStored();
        }
    }
}
