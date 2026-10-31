using System.Text;
using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Application.Events;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Events (L2-020 to L2-025) and check-in (L2-117 to L2-122). Every route requires authentication unless it opts out explicitly.</summary>
public static class EventsEndpoints
{
    public static IEndpointRouteBuilder MapEventsEndpoints(this IEndpointRouteBuilder app)
    {
        var events = app.MapGroup("/api/events");

        events.MapGet("", async (string? filter, string? chapter, ListEventsHandler handler, CancellationToken cancellationToken) =>
        {
            var parsed = EventListFilter.Upcoming;
            if (!string.IsNullOrEmpty(filter))
            {
                // Names only: Enum.TryParse would also accept numbers such as "7".
                if (!Enum.GetNames<EventListFilter>().Contains(filter, StringComparer.OrdinalIgnoreCase))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["filter"] = ["Filter by Upcoming, Past, Hackathons or Online."],
                    });
                }

                parsed = Enum.Parse<EventListFilter>(filter, ignoreCase: true);
            }

            // chapter={id} lists one chapter's events; chapter=none the organisation-wide ones (L2-142 AC2).
            var organisationWide = string.Equals(chapter, "none", StringComparison.OrdinalIgnoreCase);
            Guid? chapterId = null;
            if (!string.IsNullOrEmpty(chapter) && !organisationWide)
            {
                if (!Guid.TryParse(chapter, out var id))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["chapter"] = ["Filter by a chapter from the list."],
                    });
                }

                chapterId = id;
            }

            return Results.Ok(await handler.HandleAsync(new ListEventsQuery(parsed, chapterId, organisationWide), cancellationToken));
        });

        events.MapGet("/{id:guid}", async (Guid id, GetEventHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(id, cancellationToken) is { } found ? Results.Ok(found) : Results.NotFound());

        events.MapPost("", async (SaveEventCommand command, SaveEventHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, id) = await handler.CreateAsync(command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/events/{id}", new { id }));
            })
            .Validate<SaveEventCommand>();

        events.MapPut("/{id:guid}", async (Guid id, SaveEventCommand command, SaveEventHandler handler, CancellationToken cancellationToken) =>
                (await handler.UpdateAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<SaveEventCommand>();

        events.MapPost("/{id:guid}/cancel", async (Guid id, CancelEventCommand command, CancelEventHandler handler, CancellationToken cancellationToken) =>
                (await handler.HandleAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<CancelEventCommand>();

        events.MapPost("/{id:guid}/rsvps", async (Guid id, RsvpHandler handler, CancellationToken cancellationToken) =>
            (await handler.RsvpAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        events.MapDelete("/{id:guid}/rsvps/me", async (Guid id, RsvpHandler handler, CancellationToken cancellationToken) =>
            (await handler.CancelAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        events.MapGet("/{id:guid}/rsvps.csv", async (Guid id, RsvpHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, file) = await handler.ExportAsync(id, cancellationToken);
            return result.ToHttp(() => Results.File(Encoding.UTF8.GetBytes(file!.Content), "text/csv", file.FileName));
        });

        // Check-in at the door (L2-117 to L2-119): lead roles and System Admins write, Staff read.
        events.MapGet("/{id:guid}/check-in", async (Guid id, CheckInHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, checkIn) = await handler.GetAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(checkIn));
        });

        events.MapPut("/{id:guid}/check-ins/{rsvpId:guid}", async (Guid id, Guid rsvpId, CheckInHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, attendee) = await handler.CheckInAsync(id, rsvpId, cancellationToken);
            return result.ToHttp(() => Results.Ok(attendee));
        });

        events.MapDelete("/{id:guid}/check-ins/{rsvpId:guid}", async (Guid id, Guid rsvpId, CheckInHandler handler, CancellationToken cancellationToken) =>
            (await handler.UndoAsync(id, rsvpId, cancellationToken)).ToHttp(Results.NoContent));

        // A new walk-in answers 201; a reused RSVP answers 200 (L2-120 AC5).
        events.MapPost("/{id:guid}/walk-ins", async (Guid id, AddWalkInCommand command, AddWalkInHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, walkIn) = await handler.HandleAsync(id, command, cancellationToken);
                return result.ToHttp(() => walkIn!.Reused
                    ? Results.Ok(walkIn)
                    : Results.Created($"/api/events/{id}/check-in", walkIn));
            })
            .Validate<AddWalkInCommand>();

        events.MapGet("/{id:guid}/check-ins.csv", async (Guid id, ExportCheckInsHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, file) = await handler.HandleAsync(id, cancellationToken);
            return result.ToHttp(() => Results.File(Encoding.UTF8.GetBytes(file!.Content), "text/csv", file.FileName));
        });

        events.MapGet("/{id:guid}/calendar.ics", async (Guid id, GetEventCalendarHandler handler, CancellationToken cancellationToken) =>
            await handler.ForMemberAsync(id, cancellationToken) is { } file ? Calendar(file) : Results.NotFound());

        // The share link and guest RSVP are for anonymous visitors, public events only (L2-023).
        var publicEvents = app.MapGroup("/api/public/events").AllowAnonymous();

        publicEvents.MapGet("/{id:guid}", async (Guid id, PublicEventsHandler handler, CancellationToken cancellationToken) =>
            await handler.GetAsync(id, cancellationToken) is { } found ? Results.Ok(found) : Results.NotFound());

        publicEvents.MapGet("/{id:guid}/calendar.ics", async (Guid id, GetEventCalendarHandler handler, CancellationToken cancellationToken) =>
            await handler.ForAnyoneAsync(id, cancellationToken) is { } file ? Calendar(file) : Results.NotFound());

        publicEvents.MapPost("/{id:guid}/rsvps", async (Guid id, GuestRsvpCommand command, PublicEventsHandler handler, CancellationToken cancellationToken) =>
                (await handler.RsvpAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<GuestRsvpCommand>()
            .RequireRateLimiting(WebProtectionSetup.GuestRsvpRateLimitPolicy);

        publicEvents.MapPost("/{id:guid}/rsvps/cancel", async (Guid id, CancelGuestRsvpCommand command, PublicEventsHandler handler, CancellationToken cancellationToken) =>
                (await handler.CancelAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .RequireRateLimiting(WebProtectionSetup.GuestRsvpRateLimitPolicy);

        return app;
    }

    private static IResult Calendar(CalendarFile file) =>
        Results.File(Encoding.UTF8.GetBytes(file.Content), "text/calendar", file.FileName);
}
