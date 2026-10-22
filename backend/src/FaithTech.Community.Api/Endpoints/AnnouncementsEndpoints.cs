using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Application.Announcements;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Announcements (L2-029, L2-030). Communications Leads and System Admins preview the recipient count and send;
/// anyone else gets 403. Every member reads their own announcements and sets the email opt-out.
/// </summary>
public static class AnnouncementsEndpoints
{
    public static IEndpointRouteBuilder MapAnnouncementsEndpoints(this IEndpointRouteBuilder app)
    {
        var announcements = app.MapGroup("/api/announcements");

        announcements.MapPost("/recipient-count", async (AudienceRequest audience, SendAnnouncementHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, count) = await handler.CountAsync(audience, cancellationToken);
                return result.ToHttp(() => Results.Ok(new { Count = count }));
            })
            .Validate<AudienceRequest>();

        announcements.MapPost("", async (SendAnnouncementCommand command, SendAnnouncementHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, sent) = await handler.SendAsync(command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/announcements/{sent!.Id}", sent));
            })
            .Validate<SendAnnouncementCommand>();

        announcements.MapGet("", async (int? page, ListMyAnnouncementsHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.ListAsync(page ?? 1, cancellationToken)));

        app.MapGet("/api/me/announcement-email-opt-out", async (AnnouncementEmailOptOutHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.GetAsync(cancellationToken)));

        app.MapPut("/api/me/announcement-email-opt-out", async (AnnouncementEmailOptOut command, AnnouncementEmailOptOutHandler handler, CancellationToken cancellationToken) =>
            (await handler.SetAsync(command, cancellationToken)).ToHttp(Results.NoContent));

        // The unsubscribe link in an announcement email works without a sign-in (L2-030 AC3). The signed token is
        // the credential and can only turn announcement emails off; it travels in the body, never the path.
        announcements.MapPost("/unsubscribe", async (UnsubscribeCommand command, UnsubscribeHandler handler, CancellationToken cancellationToken) =>
                (await handler.UnsubscribeAsync(command, cancellationToken)).ToHttp(Results.NoContent))
            .AllowAnonymous()
            .RequireRateLimiting(WebProtectionSetup.AuthRateLimitPolicy);

        return app;
    }
}
