using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace FaithTech.Community.Cli;

public static class CliApp
{
    public static async Task<int> RunAsync(string[] args, Action<DbContextOptionsBuilder> configureDatabase, string webAppOrigin)
    {
        await using var services = new ServiceCollection()
            .AddDbContext<CommunityDbContext>(options => configureDatabase(options.UseOpenIddict()))
            .AddScoped<CommunitySeeder>()
            .AddOpenIddict().AddCore(options => options.UseEntityFrameworkCore().UseDbContext<CommunityDbContext>()).Services
            .BuildServiceProvider();
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CommunityDbContext>();

        switch (args.FirstOrDefault())
        {
            case "migrate":
                await CreateSchemaAsync(db);
                return 0;
            case "seed":
                await scope.ServiceProvider.GetRequiredService<CommunitySeeder>().SeedAsync(webAppOrigin);
                return 0;
            case "reset":
                NpgsqlConnection.ClearAllPools();
                await db.Database.EnsureDeletedAsync();
                await CreateSchemaAsync(db);
                return 0;
            default:
                Console.Error.WriteLine("Usage: faithtech-community <migrate|seed|reset>");
                return 1;
        }
    }

    // Relational databases get the EF migrations; the in-memory test database has no migrations.
    private static Task CreateSchemaAsync(CommunityDbContext db) =>
        db.Database.IsRelational() ? db.Database.MigrateAsync() : db.Database.EnsureCreatedAsync();
}
