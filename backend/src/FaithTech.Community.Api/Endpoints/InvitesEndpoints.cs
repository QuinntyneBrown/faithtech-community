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

        invites.MapGet("", async (ManageInvitesHandler handler, CancellationToken cancellationToken) =>
            await handler.ListAsync(cancellationToken) is { } list ? Results.Ok(list) : Results.Forbid());

        invites.MapPost("/{id:guid}/resend", async (Guid id, ManageInvitesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, invite) = await handler.ResendAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Created("/api/invites", invite));
        });

        invites.MapPost("/{id:guid}/revoke", async (Guid id, ManageInvitesHandler handler, CancellationToken cancellationToken) =>
            (await handler.RevokeAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        return app;
    }
}
