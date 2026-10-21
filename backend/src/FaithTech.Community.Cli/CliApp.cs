using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace FaithTech.Community.Cli;

public static class CliApp
{
    public static async Task<int> RunAsync(string[] args, string connectionString, string webAppOrigin = "http://localhost:4200")
    {
        await using var services = new ServiceCollection()
            .AddDbContext<CommunityDbContext>(options => options.UseNpgsql(connectionString).UseOpenIddict())
            .AddScoped<CommunitySeeder>()
            .AddOpenIddict().AddCore(options => options.UseEntityFrameworkCore().UseDbContext<CommunityDbContext>()).Services
            .BuildServiceProvider();
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CommunityDbContext>();

        switch (args.FirstOrDefault())
        {
            case "migrate":
                await db.Database.MigrateAsync();
                return 0;
            case "seed":
                await scope.ServiceProvider.GetRequiredService<CommunitySeeder>().SeedAsync(webAppOrigin);
                return 0;
            case "reset":
                NpgsqlConnection.ClearAllPools();
                await db.Database.EnsureDeletedAsync();
                await db.Database.MigrateAsync();
                return 0;
            default:
                Console.Error.WriteLine("Usage: faithtech-community <migrate|seed|reset>");
                return 1;
        }
    }
}
