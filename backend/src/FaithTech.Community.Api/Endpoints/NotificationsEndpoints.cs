using FaithTech.Community.Application.Notifications;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The caller's in-app notifications (L2-027). Signed-in members only; each sees only their own.</summary>
public static class NotificationsEndpoints
{
    public static IEndpointRouteBuilder MapNotificationsEndpoints(this IEndpointRouteBuilder app)
    {
        var notifications = app.MapGroup("/api/notifications");

        notifications.MapGet("", async (bool? unreadOnly, int? page, InAppNotificationsHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.ListAsync(unreadOnly ?? false, page ?? 1, cancellationToken)));

        notifications.MapGet("/unread-count", async (InAppNotificationsHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(new { Count = await handler.UnreadCountAsync(cancellationToken) }));

        notifications.MapPost("/{id:guid}/read", async (Guid id, InAppNotificationsHandler handler, CancellationToken cancellationToken) =>
            (await handler.MarkReadAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        notifications.MapPost("/read-all", async (InAppNotificationsHandler handler, CancellationToken cancellationToken) =>
        {
            await handler.MarkAllReadAsync(cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
