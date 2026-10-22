using FaithTech.Community.Application.Notifications;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The caller's in-app notifications (L2-027). Every route requires authentication.</summary>
public static class NotificationsEndpoints
{
    public static IEndpointRouteBuilder MapNotificationsEndpoints(this IEndpointRouteBuilder app)
    {
        var notifications = app.MapGroup("/api/notifications");

        notifications.MapGet("", async (int? page, bool? unreadOnly, ManageNotificationsHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.ListAsync(page ?? 1, unreadOnly ?? false, cancellationToken)));

        notifications.MapGet("/unread-count", async (ManageNotificationsHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(new { Count = await handler.UnreadCountAsync(cancellationToken) }));

        notifications.MapPost("/{id:guid}/read", async (Guid id, ManageNotificationsHandler handler, CancellationToken cancellationToken) =>
            (await handler.MarkReadAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        notifications.MapPost("/read-all", async (ManageNotificationsHandler handler, CancellationToken cancellationToken) =>
        {
            await handler.MarkAllReadAsync(cancellationToken);
            return Results.NoContent();
        });

        return app;
    }
}
