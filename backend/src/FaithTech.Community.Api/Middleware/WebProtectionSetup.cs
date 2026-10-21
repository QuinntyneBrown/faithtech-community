using System.Threading.RateLimiting;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Middleware;

public static class WebProtectionSetup
{
    public const string WebAppCorsPolicy = "web-app";
    public const string AuthRateLimitPolicy = "auth";

    public static IServiceCollection AddWebProtections(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddCors(options => options.AddPolicy(WebAppCorsPolicy, policy => policy
            .WithOrigins(configuration["WebApp:Origin"] ?? throw new InvalidOperationException("WebApp:Origin is not configured."))
            .AllowAnyHeader()
            .AllowAnyMethod()));

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // 100 requests a minute per signed-in user, or per IP address for anonymous callers.
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value is { } userId
                        ? $"user:{userId}"
                        : $"ip:{context.Connection.RemoteIpAddress}",
                    _ => Window(100)));

            // 20 requests a minute per IP address for sign-in, sign-up, reset and verification.
            options.AddPolicy(AuthRateLimitPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter($"auth:{context.Connection.RemoteIpAddress}", _ => Window(20)));
        });
        return services;
    }

    private static FixedWindowRateLimiterOptions Window(int permitLimit) =>
        new() { PermitLimit = permitLimit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 };
}
