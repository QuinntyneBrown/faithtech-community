using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Infrastructure.Organisations;

/// <summary>
/// Runs a worker's unit of work once per organisation, each in its own service scope with that organisation in
/// scope, so the work sees and writes only that organisation's rows (ADR 0032).
/// </summary>
public class OrganisationWork(IServiceScopeFactory scopes)
{
    public async Task ForEachAsync(Func<IServiceProvider, CancellationToken, Task> work, CancellationToken cancellationToken = default)
    {
        List<Organisation> organisations;
        await using (var lookup = scopes.CreateAsyncScope())
        {
            organisations = await lookup.ServiceProvider.GetRequiredService<CommunityDbContext>().Organisations
                .Where(o => o.Status != OrganisationStatus.Provisioning)
                .OrderBy(o => o.CreatedAtUtc)
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        foreach (var organisation in organisations)
        {
            await using var scope = scopes.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<OrganisationScope>().Set(organisation);
            await work(scope.ServiceProvider, cancellationToken);
        }
    }
}
