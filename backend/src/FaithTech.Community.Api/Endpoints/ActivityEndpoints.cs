using FaithTech.Community.Application.Notifications;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Home's recent-activity feed for the signed-in caller (L2-049, ADR 0016).</summary>
public static class ActivityEndpoints
{
    public static IEndpointRouteBuilder MapActivityEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/activity", async (ListActivityHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(cancellationToken) is { } feed ? Results.Ok(feed) : Results.Forbid());

        return app;
    }
}
