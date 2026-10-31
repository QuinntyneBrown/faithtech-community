using FaithTech.Community.Application.Common;
using FaithTech.Community.Infrastructure.Persistence;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Abstractions;
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

                options.RegisterScopes(
                    OpenIddictConstants.Scopes.OpenId,
                    OpenIddictConstants.Scopes.Email,
                    OpenIddictConstants.Scopes.Profile,
                    OpenIddictConstants.Scopes.Roles,
                    OpenIddictConstants.Scopes.OfflineAccess);
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
                options.EnableAuthorizationEntryValidation();
                options.UseAspNetCore();
            });

        services.AddAuthentication(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)
            .AddCookie(IdentityConstants.ApplicationScheme, options =>
            {
                // Short-lived: it only carries a signed-in browser from the sign-in page to /connect/authorize.
                options.Cookie.Name = "ftc.session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.ExpireTimeSpan = TimeSpan.FromMinutes(15);
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
            });
        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddRequirements(new MembershipRequirement())
                .Build());
        services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, MembershipHandler>();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddSingleton<GoogleCorrelation>();
        return services;
    }

    // Certificates are supplied as base64-encoded PFX values with an optional password.
    private static X509Certificate2 LoadCertificate(IConfiguration configuration, string key)
    {
        var pfx = configuration[key] ?? throw new InvalidOperationException($"{key} is not configured.");
        return X509CertificateLoader.LoadPkcs12(Convert.FromBase64String(pfx), configuration[$"{key}Password"]);
    }
}
