using System.Security.Cryptography;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Organisations.Platform;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Identity;
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
        TextWriter? output = null,
        IReadOnlyList<string>? operators = null,
        string? defaultOrganisationSlug = null)
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
            .AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<CommunityDbContext>())
            .AddSingleton(TimeProvider.System)
            // The org commands recognise operators by the same Platform:Operators list as the API (L2-148 AC1).
            .AddSingleton(Microsoft.Extensions.Options.Options.Create(new PlatformOptions { Operators = [.. operators ?? []] }))
            .AddSingleton<IPlatformOperators, PlatformOperators>()
            .AddScoped<PlatformActor>()
            .AddScoped<IPlatformAuditLog, PlatformAuditLog>()
            .AddScoped<GetPlatformAuditHandler>()
            .AddScoped<OrganisationSeeder>()
            .AddScoped<GetOrganisationSummaryHandler>()
            .AddScoped<ProvisionOrganisationHandler>()
            .AddScoped<SuspendOrganisationHandler>()
            .AddScoped<ITokenRevocation, TokenRevocation>()
            .AddScoped<IClientRedirects, ClientRedirects>()
            .AddScoped<OutboxEmailQueue>()
            .AddScoped<IEmailQueue>(sp => sp.GetRequiredService<OutboxEmailQueue>())
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
            case "grant-admin" when args.Length is 2 or 3:
                {
                    var slug = args.ElementAtOrDefault(2) ?? defaultOrganisationSlug ?? FaithTechSeed.Slug;
                    var granted = await scope.ServiceProvider.GetRequiredService<CommunitySeeder>().GrantAdministratorAsync(args[1], slug);
                    switch (granted.Outcome)
                    {
                        case GrantAdministratorOutcome.Granted:
                            await output.WriteLineAsync($"{args[1]} is an administrator in {granted.OrganisationName}.");
                            return 0;
                        case GrantAdministratorOutcome.NoOrganisation:
                            Console.Error.WriteLine($"No organisation has the slug {slug}.");
                            return 1;
                        default:
                            Console.Error.WriteLine($"No account uses {args[1]} in {granted.OrganisationName}. Sign up first, then grant the role.");
                            return 1;
                    }
                }

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
            case "org":
                return await OrgAsync(args, scope.ServiceProvider, output);
            case "reset":
                NpgsqlConnection.ClearAllPools();
                await db.Database.EnsureDeletedAsync();
                await CreateSchemaAsync(db);
                return 0;
            default:
                Console.Error.WriteLine("Usage: faithtech-community <migrate|seed|reset|grant-admin <email> [organisation-slug]|seed-load-users <count>|seed-search-records <count>|seed-report-records <members>|wall-hash|wall-key|org create|suspend|lift|audit ... --operator <email>>");
                return 1;
        }
    }

    /// <summary>
    /// The platform operators' <c>org</c> commands. Each one requires <c>--operator</c> naming an account listed in
    /// Platform:Operators, and acts as that operator with the Cli source (L2-148 AC2, AC4).
    /// </summary>
    private static async Task<int> OrgAsync(string[] args, IServiceProvider services, TextWriter output)
    {
        var email = Option(args, "--operator");
        if (!services.GetRequiredService<IPlatformOperators>().IsOperator(email))
        {
            Console.Error.WriteLine("Give --operator with an email listed in Platform:Operators.");
            return 1;
        }

        services.GetRequiredService<PlatformActor>().Set(email!.Trim(), PlatformAuditSource.Cli);
        switch (args.ElementAtOrDefault(1))
        {
            case "create":
                return await CreateAsync(args, services, output);
            case "suspend" when Slug(args) is { } slug:
                return await Report(
                    await services.GetRequiredService<SuspendOrganisationHandler>().SuspendAsync(slug, new SuspendOrganisationCommand(Option(args, "--reason"))),
                    $"Organisation {slug} suspended",
                    output);
            case "lift" when Slug(args) is { } slug:
                return await Report(await services.GetRequiredService<SuspendOrganisationHandler>().LiftAsync(slug), $"Organisation {slug} lifted", output);
            case "audit":
                var take = GetPlatformAuditHandler.DefaultPageSize;
                if (Option(args, "--take") is { } value && (!int.TryParse(value, out take) || take < 1))
                {
                    Console.Error.WriteLine("Give --take a whole number of 1 or more.");
                    return 1;
                }

                var page = await services.GetRequiredService<GetPlatformAuditHandler>().HandleAsync(1, take);
                foreach (var e in page.Items)
                {
                    await output.WriteLineAsync(
                        $"{e.OccurredAtUtc:yyyy-MM-dd HH:mm:ss}  {e.OperatorEmail}  {e.Source}  {e.Action}  {e.Target}");
                }

                return 0;
            default:
                Console.Error.WriteLine(
                    "Usage: faithtech-community org create --slug <slug> --host <host> --name <name> --short-name <short> " +
                    "[--chapter-label <Singular/Plural>] --admin-email <email> --operator <email> | org suspend <slug> --reason <reason> --operator <email> | " +
                    "org lift <slug> --operator <email> | org audit [--take <n>] --operator <email>");
                return 1;
        }
    }

    /// <summary>org create: provisions an organisation as POST /api/platform/organisations does (L2-149).</summary>
    private static async Task<int> CreateAsync(string[] args, IServiceProvider services, TextWriter output)
    {
        var label = Option(args, "--chapter-label")?.Split('/', 2);
        var command = new ProvisionOrganisationCommand(
            Option(args, "--slug"),
            Option(args, "--host"),
            Option(args, "--name"),
            Option(args, "--short-name"),
            Option(args, "--admin-email"),
            label is null ? null : new ChapterLabelCommand(label[0], label.ElementAtOrDefault(1)));
        var validation = await new ProvisionOrganisationValidator().ValidateAsync(command);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors)
            {
                Console.Error.WriteLine($"{error.PropertyName}: {error.ErrorMessage}");
            }

            return 1;
        }

        var (result, outcome, summary) = await services.GetRequiredService<ProvisionOrganisationHandler>().HandleAsync(command);
        if (result.Status != ResultStatus.Ok)
        {
            Console.Error.WriteLine(result.Detail ?? string.Join(" ", result.Errors?.SelectMany(e => e.Value) ?? []));
            return 1;
        }

        await output.WriteLineAsync($"Organisation {summary!.Slug} {(outcome == ProvisionOutcome.Created ? "created" : "exists")}");
        return 0;
    }

    // The slug of org suspend and org lift: the argument after the subcommand, when it is not an option.
    private static string? Slug(string[] args) => args.Length > 2 && !args[2].StartsWith("--", StringComparison.Ordinal) ? args[2] : null;

    // Prints the success line, or the error and exit code 1.
    private static async Task<int> Report(Result result, string success, TextWriter output)
    {
        if (result.Status != ResultStatus.Ok)
        {
            Console.Error.WriteLine(result.Status == ResultStatus.NotFound
                ? "No organisation has that slug."
                : result.Detail ?? string.Join(" ", result.Errors?.SelectMany(e => e.Value) ?? []));
            return 1;
        }

        await output.WriteLineAsync(success);
        return 0;
    }

    // The value after an option such as --operator, or null when the option or its value is missing.
    private static string? Option(string[] args, string name)
    {
        var at = Array.IndexOf(args, name);
        return at >= 0 && at + 1 < args.Length && !args[at + 1].StartsWith("--", StringComparison.Ordinal) ? args[at + 1] : null;
    }

    private static OrganisationScope FaithTechScope()
    {
        var scope = new OrganisationScope();
        scope.Set(FaithTechSeed.Organisation());
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
