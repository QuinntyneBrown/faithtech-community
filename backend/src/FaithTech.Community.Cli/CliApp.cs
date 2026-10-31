using System.Security.Cryptography;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Infrastructure.Persistence;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using FaithTech.Community.Infrastructure.PrivatePreview;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace FaithTech.Community.Cli;

public static class CliApp
{
    /// <summary>The environment variable that carries the load-test members' password, never the command line.</summary>
    public const string LoadTestPasswordVariable = "LOADTEST_PASSWORD";

    public const int MinWallPassphraseLength = 16;

    public static async Task<int> RunAsync(
        string[] args,
        Action<DbContextOptionsBuilder> configureDatabase,
        string webAppOrigin,
        Func<string, string?>? environment = null,
        TextReader? input = null,
        TextWriter? output = null)
    {
        environment ??= Environment.GetEnvironmentVariable;
        input ??= Console.In;
        output ??= Console.Out;
        await using var services = new ServiceCollection()
            .AddDbContext<CommunityDbContext>(options => configureDatabase(options.UseOpenIddict()))
            .AddScoped<CommunitySeeder>()
            // Cli commands work on the FaithTech organisation, the default one (ADR 0032).
            .AddScoped(_ => FaithTechScope())
            .AddScoped<ICurrentOrganisation>(sp => sp.GetRequiredService<OrganisationScope>())
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
            case "seed-report-records" when args.Length == 2:
                return await SeedReportRecordsAsync(scope.ServiceProvider.GetRequiredService<CommunitySeeder>(), args[1]);
            case "wall-hash":
                return await WallHashAsync(input, output);
            case "wall-key":
                await output.WriteLineAsync(Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
                return 0;
            case "reset":
                NpgsqlConnection.ClearAllPools();
                await db.Database.EnsureDeletedAsync();
                await CreateSchemaAsync(db);
                return 0;
            default:
                Console.Error.WriteLine("Usage: faithtech-community <migrate|seed|reset|grant-admin <email>|seed-load-users <count>|seed-search-records <count>|seed-report-records <members>|wall-hash|wall-key>");
                return 1;
        }
    }

    private static OrganisationScope FaithTechScope()
    {
        var scope = new OrganisationScope();
        scope.RunAs(FaithTechSeed.OrganisationId);
        return scope;
    }

    /// <summary>
    /// Hashes the private-preview passphrase read from standard input (never an argument, so it stays out of shell
    /// history) for PrivatePreview:PassphraseHash; the passphrase itself is never printed or stored (L2-105).
    /// </summary>
    private static async Task<int> WallHashAsync(TextReader input, TextWriter output)
    {
        var passphrase = (await input.ReadLineAsync())?.TrimEnd('\r') ?? string.Empty;
        if (passphrase.Length < MinWallPassphraseLength)
        {
            Console.Error.WriteLine($"Give a passphrase of at least {MinWallPassphraseLength} characters on standard input.");
            return 1;
        }

        await output.WriteLineAsync(new Pbkdf2PassphraseHasher().Hash(passphrase));
        return 0;
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

    /// <summary>Only for an isolated performance environment: never run it against a database real people use.</summary>
    private static async Task<int> SeedReportRecordsAsync(CommunitySeeder seeder, string count)
    {
        if (!int.TryParse(count, out var members) || members is < 1 or > CommunitySeeder.MaxReportMembers)
        {
            Console.Error.WriteLine($"Give a member count from 1 to {CommunitySeeder.MaxReportMembers}.");
            return 1;
        }

        var created = await seeder.SeedReportRecordsAsync(members);
        Console.WriteLine($"{members} report members, {members / 10} events and {members / 10 * 50} RSVPs ready ({created} new members).");
        return 0;
    }

    // Relational databases get the EF migrations; the in-memory test database has no migrations.
    private static Task CreateSchemaAsync(CommunityDbContext db) =>
        db.Database.IsRelational() ? db.Database.MigrateAsync() : db.Database.EnsureCreatedAsync();
}
