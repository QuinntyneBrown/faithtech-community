using FaithTech.Community.Application.Resources;
using FaithTech.Community.Infrastructure.Organisations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FaithTech.Community.Infrastructure.Storage;

/// <summary>
/// Retries resource blob work and purges resources archived 30 days ago (ADR 0017), on the outbox interval;
/// disabled with the email outbox.
/// </summary>
public class ResourceMaintenanceWorker(OrganisationWork work, IConfiguration configuration, ILogger<ResourceMaintenanceWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Outbox:Enabled", true))
        {
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(configuration.GetValue("Outbox:IntervalSeconds", 10)));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await work.ForEachAsync(
                    async (services, cancellationToken) =>
                    {
                        await services.GetRequiredService<ResourceStorageRetryHandler>().RunAsync(cancellationToken);
                        await services.GetRequiredService<PurgeArchivedResourcesHandler>().RunAsync(cancellationToken);
                    },
                    stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Resource maintenance failed");
            }
        }
    }
}
