using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Application.Announcements;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Announcements (L2-029, L2-030). Sending is for Communications Leads and System Admins; everyone else gets 403.
/// The unsubscribe link is the one anonymous route, rate-limited like the other anonymous account routes.
/// </summary>
public static class AnnouncementsEndpoints
{
    public static IEndpointRouteBuilder MapAnnouncementsEndpoints(this IEndpointRouteBuilder app)
    {
        var announcements = app.MapGroup("/api/announcements");

        announcements.MapPost("/recipient-count", async (AudienceRequest request, CountAnnouncementRecipientsHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, count) = await handler.HandleAsync(request, cancellationToken);
            return result.ToHttp(() => Results.Ok(new { Count = count }));
        });

        announcements.MapPost("", async (SendAnnouncementCommand command, SendAnnouncementHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, sent) = await handler.HandleAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Created($"/api/announcements/{sent!.Id}", sent));
        });

        announcements.MapGet("", async (int? page, ListAnnouncementsHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.HandleAsync(page ?? 1, cancellationToken)));

        announcements.MapPost("/unsubscribe", async (UnsubscribeCommand command, UnsubscribeHandler handler, CancellationToken cancellationToken) =>
                (await handler.HandleAsync(command, cancellationToken)).ToHttp(Results.NoContent))
            .AllowAnonymous()
            .RequireRateLimiting(WebProtectionSetup.AuthRateLimitPolicy);

        var optOut = app.MapGroup("/api/me/announcement-email-opt-out");

        optOut.MapGet("", async (AnnouncementEmailOptOutHandler handler, CancellationToken cancellationToken) =>
            await handler.GetAsync(cancellationToken) is { } optedOut ? Results.Ok(new { OptedOut = optedOut }) : Results.NotFound());

        optOut.MapPut("", async (EmailOptOutCommand command, AnnouncementEmailOptOutHandler handler, CancellationToken cancellationToken) =>
            (await handler.SetAsync(command, cancellationToken)).ToHttp(Results.NoContent));

        return app;
    }
}
