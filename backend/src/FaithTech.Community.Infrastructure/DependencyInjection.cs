using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<CommunityDbContext>(options =>
        {
            options.UseNpgsql(configuration.GetConnectionString("Community"));
            options.UseOpenIddict();
        });
        return services;
    }
}
