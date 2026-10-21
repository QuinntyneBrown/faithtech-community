using FaithTech.Community.Application.Announcements;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Announcements (L2-029). Sending is for Communications Leads and System Admins; everyone else gets 403.</summary>
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

        return app;
    }
}
