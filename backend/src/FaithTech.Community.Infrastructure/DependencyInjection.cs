using Azure.Storage.Blobs;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Infrastructure.Email;
using FaithTech.Community.Infrastructure.Identity;
using FaithTech.Community.Infrastructure.Persistence;
using FaithTech.Community.Infrastructure.Storage;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

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
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddEntityFrameworkStores<CommunityDbContext>()
            .AddTokenProvider<EmailConfirmationTokenProvider<CommunityUser>>(EmailConfirmationTokenProvider<CommunityUser>.Name);
        services.AddDataProtection();
        services.TryAddSingleton(TimeProvider.System);

        services.AddHttpClient<IBreachedPasswordChecker, HibpBreachedPasswordChecker>(client =>
        {
            client.BaseAddress = new Uri("https://api.pwnedpasswords.com/");
            client.Timeout = TimeSpan.FromSeconds(3);
            client.DefaultRequestHeaders.Add("Add-Padding", "true");
        });
        services.AddScoped<IVerificationResendLog, VerificationResendLog>();
        services.AddScoped<ITokenRevocation, TokenRevocation>();
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.Section));
        services.AddScoped<IEmailSender, SmtpEmailSender>();

        services.AddSingleton(_ => new BlobServiceClient(configuration.GetConnectionString("Blobs")));

        services.AddScoped<CommunitySeeder>();

        services.AddHealthChecks()
            .AddDbContextCheck<CommunityDbContext>("database", tags: [ReadyTag])
            .AddCheck<BlobStorageHealthCheck>("blobs", tags: [ReadyTag]);
        return services;
    }
}
