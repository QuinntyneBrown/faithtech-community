using FaithTech.Community.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace FaithTech.Community.Cli;

public static class CliApp
{
    /// <summary>The environment variable that carries the load-test members' password, never the command line.</summary>
    public const string LoadTestPasswordVariable = "LOADTEST_PASSWORD";

    public static async Task<int> RunAsync(
        string[] args,
        Action<DbContextOptionsBuilder> configureDatabase,
        string webAppOrigin,
        Func<string, string?>? environment = null)
    {
        environment ??= Environment.GetEnvironmentVariable;
        await using var services = new ServiceCollection()
            .AddDbContext<CommunityDbContext>(options => configureDatabase(options.UseOpenIddict()))
            .AddScoped<CommunitySeeder>()
            .AddSingleton(TimeProvider.System)
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
            case "grant-admin" when args.Length == 2:
                if (await scope.ServiceProvider.GetRequiredService<CommunitySeeder>().GrantSystemAdminAsync(args[1]))
                {
                    return 0;
                }

                Console.Error.WriteLine($"No account uses {args[1]}. Sign up first, then grant the role.");
                return 1;
            case "seed-load-users" when args.Length == 2:
                return await SeedLoadUsersAsync(scope.ServiceProvider.GetRequiredService<CommunitySeeder>(), args[1], environment(LoadTestPasswordVariable));
            case "seed-search-records" when args.Length == 2:
                return await SeedSearchRecordsAsync(scope.ServiceProvider.GetRequiredService<CommunitySeeder>(), args[1]);
            case "reset":
                NpgsqlConnection.ClearAllPools();
                await db.Database.EnsureDeletedAsync();
                await CreateSchemaAsync(db);
                return 0;
            default:
                Console.Error.WriteLine("Usage: faithtech-community <migrate|seed|reset|grant-admin <email>|seed-load-users <count>|seed-search-records <count>>");
                return 1;
        }
    }

    /// <summary>Only for an isolated performance environment: never run it against a database real people use.</summary>
    private static async Task<int> SeedLoadUsersAsync(CommunitySeeder seeder, string count, string? password)
    {
        if (!int.TryParse(count, out var users) || users is < 1 or > CommunitySeeder.MaxLoadTestUsers)
        {
            Console.Error.WriteLine($"Give a count from 1 to {CommunitySeeder.MaxLoadTestUsers}.");
            return 1;
        }

        if (password is null || password.Length < 12)
        {
            Console.Error.WriteLine($"Set {LoadTestPasswordVariable} to a password of at least 12 characters.");
            return 1;
        }

        var created = await seeder.SeedLoadTestUsersAsync(users, password);
        Console.WriteLine($"{users} load-test members ready ({created} new): load-001@{CommunitySeeder.LoadTestDomain} onwards.");
        return 0;
    }

    /// <summary>Only for an isolated performance environment: never run it against a database real people use.</summary>
    private static async Task<int> SeedSearchRecordsAsync(CommunitySeeder seeder, string count)
    {
        if (!int.TryParse(count, out var records) || records is < 1 or > CommunitySeeder.MaxSearchRecords)
        {
            Console.Error.WriteLine($"Give a count from 1 to {CommunitySeeder.MaxSearchRecords}.");
            return 1;
        }

        var created = await seeder.SeedSearchRecordsAsync(records);
        Console.WriteLine($"{records} searchable load-test events ready ({created} new).");
        return 0;
    }

    // Relational databases get the EF migrations; the in-memory test database has no migrations.
    private static Task CreateSchemaAsync(CommunityDbContext db) =>
        db.Database.IsRelational() ? db.Database.MigrateAsync() : db.Database.EnsureCreatedAsync();
}
