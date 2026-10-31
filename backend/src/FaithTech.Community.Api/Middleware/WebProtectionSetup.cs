using System.Threading.RateLimiting;
using FaithTech.Community.Api.Middleware.Organisations;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Middleware;

public static class WebProtectionSetup
{
    public const string WebAppCorsPolicy = "web-app";
    public const string AuthRateLimitPolicy = "auth";
    public const string GuestRsvpRateLimitPolicy = "guest-rsvp";

    public static IServiceCollection AddWebProtections(this IServiceCollection services, IConfiguration configuration)
    {
        // An organisation's marketing page posts credentials from its public host, so the session cookie the sign-in
        // sets must be allowed through: credentials are allowed only for the origins of the organisation the request's
        // host belongs to, its community origin and its public hosts' origins (L2-131 AC6, ADR 0018).
        services.AddCors();
        services.AddOptions<CorsOptions>().Configure<IHttpContextAccessor>((options, accessor) =>
            options.AddPolicy(WebAppCorsPolicy, policy => policy
                .SetIsOriginAllowed(origin => IsOrganisationOrigin(accessor.HttpContext, origin))
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials()));

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // 100 requests a minute per signed-in user, or per IP address for anonymous callers. Only an
            // isolated performance environment sets RateLimits:PerMinute (eng/load-test.js); nothing else does.
            var permitLimit = configuration.GetValue("RateLimits:PerMinute", 100);
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value is { } userId
                        ? $"user:{userId}"
                        : $"ip:{context.Connection.RemoteIpAddress}",
                    _ => Window(permitLimit)));

            // 20 requests a minute per IP address for sign-in, sign-up, reset and verification.
            var authPermitLimit = configuration.GetValue("RateLimits:AuthPerMinute", 20);
            options.AddPolicy(AuthRateLimitPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter($"auth:{context.Connection.RemoteIpAddress}", _ => Window(authPermitLimit)));

            // 10 guest RSVPs (and guest cancellations) an hour per IP address (L2-023 AC4).
            var guestPermitLimit = configuration.GetValue("RateLimits:GuestRsvpPerHour", 10);
            options.AddPolicy(GuestRsvpRateLimitPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    $"guest-rsvp:{context.Connection.RemoteIpAddress}",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = guestPermitLimit, Window = TimeSpan.FromHours(1), QueueLimit = 0 }));
        });
        return services;
    }

    private static bool IsOrganisationOrigin(HttpContext? context, string origin)
    {
        if (context?.Items[OrganisationResolutionMiddleware.OrganisationItem] is not Organisation organisation)
        {
            return false;
        }

        var services = context.RequestServices;
        var current = services.GetRequiredService<ICurrentOrganisation>();
        var marketing = services.GetRequiredService<IOptions<MarketingOptions>>().Value;
        var defaultSlug = services.GetRequiredService<IOptions<PlatformOptions>>().Value.DefaultOrganisationSlug;
        return marketing.PublicOriginsOf(organisation.Slug, defaultSlug)
            .Prepend(current.Origin)
            .Any(allowed => string.Equals(allowed, origin, StringComparison.OrdinalIgnoreCase));
    }

    private static FixedWindowRateLimiterOptions Window(int permitLimit) =>
        new() { PermitLimit = permitLimit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 };
}
