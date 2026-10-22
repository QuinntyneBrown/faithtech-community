using Azure.Storage.Blobs;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Announcements;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Events;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Invites;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Application.Resources;
using FaithTech.Community.Application.Search;
using FaithTech.Community.Infrastructure.Admin;
using FaithTech.Community.Infrastructure.Calendar;
using FaithTech.Community.Infrastructure.Csv;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Identity;
using FaithTech.Community.Infrastructure.Invites;
using FaithTech.Community.Infrastructure.Persistence;
using FaithTech.Community.Infrastructure.Search;
using FaithTech.Community.Infrastructure.Storage;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

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
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<CommunityDbContext>());

        services.AddIdentityCore<CommunityUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = PasswordRules.MinimumLength;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Tokens.EmailConfirmationTokenProvider = EmailConfirmationTokenProvider<CommunityUser>.Name;
                options.Tokens.PasswordResetTokenProvider = PasswordResetTokenProvider<CommunityUser>.Name;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddEntityFrameworkStores<CommunityDbContext>()
            .AddTokenProvider<EmailConfirmationTokenProvider<CommunityUser>>(EmailConfirmationTokenProvider<CommunityUser>.Name)
            .AddTokenProvider<PasswordResetTokenProvider<CommunityUser>>(PasswordResetTokenProvider<CommunityUser>.Name);
        services.AddDataProtection();
        services.TryAddSingleton(TimeProvider.System);

        services.AddHttpClient<IBreachedPasswordChecker, HibpBreachedPasswordChecker>(client =>
        {
            client.BaseAddress = new Uri("https://api.pwnedpasswords.com/");
            client.Timeout = TimeSpan.FromSeconds(3);
            client.DefaultRequestHeaders.Add("Add-Padding", "true");
        });
        // Google sign-in (ADR 0019): Google's signing keys come from its discovery document, refreshed by the manager.
        services.Configure<GoogleOptions>(configuration.GetSection(GoogleOptions.Section));
        services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(_ =>
            new ConfigurationManager<OpenIdConnectConfiguration>(
                GoogleIdTokenValidator.DiscoveryDocument,
                new OpenIdConnectConfigurationRetriever(),
                new HttpDocumentRetriever { RequireHttps = true }));
        services.AddSingleton<GoogleIdTokenValidator>();
        services.AddHttpClient<IGoogleIdentityProvider, GoogleIdentityProvider>(client => client.Timeout = TimeSpan.FromSeconds(10));
        services.AddScoped<IVerificationResendLog, VerificationResendLog>();
        services.AddScoped<ITokenRevocation, TokenRevocation>();
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.Section));
        services.AddScoped<OutboxEmailQueue>();
        services.AddScoped<IEmailQueue>(sp => sp.GetRequiredService<OutboxEmailQueue>());
        services.AddScoped<IEmailSender, OutboxEmailSender>();
        services.AddScoped<IEmailTransport, SmtpEmailTransport>();
        services.AddScoped<EmailOutboxDispatcher>();
        services.AddSingleton<IUnsubscribeTokens, DataProtectionUnsubscribeTokens>();
        services.AddSingleton<IConnectTokenProtector, DataProtectionConnectTokens>();
        services.AddHostedService<EmailOutboxWorker>();

        services.AddSingleton(_ => new BlobServiceClient(configuration.GetConnectionString("Blobs")));
        services.AddSingleton<IPhotoStorage, AzureBlobPhotoStorage>();
        services.AddSingleton<IImageProcessor, SkiaImageProcessor>();
        services.AddHostedService<PhotoStorageRetryWorker>();
        services.AddSingleton<IFileStorage, AzureBlobFileStorage>();
        services.AddHostedService<ResourceMaintenanceWorker>();

        services.AddHttpContextAccessor();
        services.AddScoped<IAuditLog, AuditLog>();
        services.AddSingleton<IIcsCalendarWriter, IcsCalendarWriter>();
        services.AddSingleton<ICsvWriter, CsvWriter>();

        services.AddSingleton<IFullTextSearch, PostgresFullTextSearch>();

        services.AddScoped<CommunitySeeder>();

        services.AddHealthChecks()
            .AddDbContextCheck<CommunityDbContext>("database", tags: [ReadyTag])
            .AddCheck<BlobStorageHealthCheck>("blobs", tags: [ReadyTag]);
        return services;
    }
}
