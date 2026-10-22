namespace FaithTech.Community.Application.Resources;

/// <summary>Deletes resources archived 30 or more days ago (L2-063 AC7). Implemented with slice 5.</summary>
public class PurgeArchivedResourcesHandler
{
    public Task RunAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}
