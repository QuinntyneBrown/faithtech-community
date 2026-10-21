using FaithTech.Community.Application.Common;
using FaithTech.Community.Infrastructure.Persistence;
using System.Security.Cryptography.X509Certificates;
using OpenIddict.Validation.AspNetCore;

namespace FaithTech.Community.Api.Authentication;

public static class AuthenticationSetup
{
    public static IServiceCollection AddCommunityAuthentication(
        this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        services.AddOpenIddict()
            .AddCore(options => options.UseEntityFrameworkCore().UseDbContext<CommunityDbContext>())
            .AddServer(options =>
            {
                options.SetAuthorizationEndpointUris("connect/authorize")
                    .SetTokenEndpointUris("connect/token")
                    .SetRevocationEndpointUris("connect/revoke")
                    .SetEndSessionEndpointUris("connect/logout");

                options.AllowAuthorizationCodeFlow().RequireProofKeyForCodeExchange();
                options.AllowRefreshTokenFlow();
                options.SetAccessTokenLifetime(TimeSpan.FromMinutes(15));
                options.SetRefreshTokenLifetime(TimeSpan.FromDays(14));

                if (environment.IsProduction())
                {
                    options.AddEncryptionCertificate(LoadCertificate(configuration, "Identity:EncryptionCertificate"))
                        .AddSigningCertificate(LoadCertificate(configuration, "Identity:SigningCertificate"));
                }
                else
                {
                    options.AddEphemeralEncryptionKey().AddEphemeralSigningKey();
                }

                options.UseAspNetCore()
                    .EnableAuthorizationEndpointPassthrough()
                    .EnableEndSessionEndpointPassthrough();
            })
            .AddValidation(options =>
            {
                options.UseLocalServer();
                options.EnableTokenEntryValidation();
                options.UseAspNetCore();
            });

        services.AddAuthentication(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);
        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build());

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        return services;
    }

    // Certificates are supplied as base64-encoded PFX values with an optional password.
    private static X509Certificate2 LoadCertificate(IConfiguration configuration, string key)
    {
        var pfx = configuration[key] ?? throw new InvalidOperationException($"{key} is not configured.");
        return X509CertificateLoader.LoadPkcs12(Convert.FromBase64String(pfx), configuration[$"{key}Password"]);
    }
}
