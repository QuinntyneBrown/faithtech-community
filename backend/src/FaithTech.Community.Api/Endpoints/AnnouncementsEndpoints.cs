using FaithTech.Community.Application.Announcements;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Announcements (L2-029). Communications Leads and System Admins preview the recipient count and send; anyone
/// else gets 403.
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

        return app;
    }
}
