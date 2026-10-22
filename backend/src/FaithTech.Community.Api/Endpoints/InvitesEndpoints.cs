using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Application.Invites;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Invites (L2-010, L2-011). Sending and managing require a lead or System Admin.</summary>
public static class InvitesEndpoints
{
    public static IEndpointRouteBuilder MapInvitesEndpoints(this IEndpointRouteBuilder app)
    {
        var invites = app.MapGroup("/api/invites");

        invites.MapPost("", async (SendInviteCommand command, InviteSender sender, CancellationToken cancellationToken) =>
            {
                var (result, invite) = await sender.SendAsync(command, cancellationToken);
                return result.ToHttp(() => Results.Created("/api/invites", invite));
            })
            .Validate<SendInviteCommand>();

        invites.MapGet("", async (string? after, int? pageSize, ManageInvitesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, page) = await handler.ListAsync(after, pageSize, cancellationToken);
            return result.ToHttp(() => Results.Ok(page));
        });

        invites.MapPost("/{id:guid}/resend", async (Guid id, ManageInvitesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, invite) = await handler.ResendAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Created("/api/invites", invite));
        });

        invites.MapPost("/{id:guid}/revoke", async (Guid id, ManageInvitesHandler handler, CancellationToken cancellationToken) =>
            (await handler.RevokeAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        // The invite link is the credential, so these two are anonymous (L2-011). The token travels in the
        // body, never the path, so it cannot reach request logs (L2-043).
        invites.MapPost("/lookup", async (InviteLookupRequest request, AcceptInviteHandler handler, CancellationToken cancellationToken) =>
                await handler.LookUpAsync(request.Token ?? string.Empty, cancellationToken) is { } invite ? Results.Ok(invite) : Results.NotFound())
            .AllowAnonymous()
            .RequireRateLimiting(WebProtectionSetup.AuthRateLimitPolicy);

        invites.MapPost("/accept", async (AcceptInviteCommand command, AcceptInviteHandler handler, CancellationToken cancellationToken) =>
                (await handler.AcceptAsync(command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<AcceptInviteCommand>()
            .AllowAnonymous()
            .RequireRateLimiting(WebProtectionSetup.AuthRateLimitPolicy);

        return app;
    }
}
