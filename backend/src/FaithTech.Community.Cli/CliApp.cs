using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FaithTech.Community.Cli;

public static class CliApp
{
    public static async Task<int> RunAsync(string[] args, string connectionString)
    {
        await using var db = new CommunityDbContext(
            new DbContextOptionsBuilder<CommunityDbContext>().UseNpgsql(connectionString).UseOpenIddict().Options);

        switch (args.FirstOrDefault())
        {
            case "migrate":
                await db.Database.MigrateAsync();
                return 0;
            case "reset":
                NpgsqlConnection.ClearAllPools();
                await db.Database.EnsureDeletedAsync();
                await db.Database.MigrateAsync();
                return 0;
            default:
                Console.Error.WriteLine("Usage: faithtech-community <migrate|reset>");
                return 1;
        }
    }
}
