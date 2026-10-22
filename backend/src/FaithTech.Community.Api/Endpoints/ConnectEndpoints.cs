using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Application.Invites;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Connect links: a City Lead's reusable QR code (L2-080 to L2-083, ADR 0021).</summary>
public static class ConnectEndpoints
{
    public static IEndpointRouteBuilder MapConnectEndpoints(this IEndpointRouteBuilder app)
    {
        var connect = app.MapGroup("/api/connect");

        connect.MapGet("/link", async (ConnectLinkHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, link) = await handler.GetOrIssueAsync(cancellationToken);
            return result.ToHttp(() => Results.Ok(link));
        });

        connect.MapPost("/link", async (ConnectLinkHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, link) = await handler.ReplaceAsync(cancellationToken);
            return result.ToHttp(() => Results.Ok(link));
        });

        // A signed-in member who opens a link is connected to its owner directly (L2-082 AC4).
        connect.MapPost("", async (ConnectRequest request, ConnectHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, connection) = await handler.ConnectAsync(request.Token ?? string.Empty, cancellationToken);
            return result.ToHttp(() => Results.Ok(connection));
        });

        // The link is the credential, so the lookup is anonymous; the token travels in the body (L2-043).
        connect.MapPost("/lookup", async (ConnectLookupRequest request, ConnectLinkHandler handler, CancellationToken cancellationToken) =>
                await handler.LookUpAsync(request.Token ?? string.Empty, cancellationToken) is { } lead ? Results.Ok(lead) : Results.NotFound())
            .AllowAnonymous()
            .RequireRateLimiting(WebProtectionSetup.AuthRateLimitPolicy);

        // Sign-up through the link answers 202 whether or not the email is registered (L2-083 AC2).
        connect.MapPost("/sign-up", async (ConnectSignUpCommand command, ConnectHandler handler, CancellationToken cancellationToken) =>
                (await handler.SignUpAsync(command, cancellationToken)).ToHttp(() => Results.Accepted()))
            .Validate<ConnectSignUpCommand>()
            .AllowAnonymous()
            .RequireRateLimiting(WebProtectionSetup.AuthRateLimitPolicy);

        return app;
    }
}
