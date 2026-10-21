using Azure.Storage.Blobs;
using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Infrastructure;

public static class DependencyInjection
{
    public const string ReadyTag = "ready";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<CommunityDbContext>(options =>
        {
            options.UseNpgsql(configuration.GetConnectionString("Community"));
            options.UseOpenIddict();
        });
        services.AddSingleton(_ => new BlobServiceClient(configuration.GetConnectionString("Blobs")));

        services.AddHealthChecks()
            .AddNpgSql(_ => configuration.GetConnectionString("Community")!, name: "postgres", tags: [ReadyTag])
            .AddAzureBlobStorage(name: "blobs", tags: [ReadyTag]);
        return services;
    }
}
