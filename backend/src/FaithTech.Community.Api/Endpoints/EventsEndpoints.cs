using System.Text;
using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Application.Events;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Events (L2-020 to L2-025). Every route requires authentication unless it opts out explicitly.</summary>
public static class EventsEndpoints
{
    public static IEndpointRouteBuilder MapEventsEndpoints(this IEndpointRouteBuilder app)
    {
        var events = app.MapGroup("/api/events");

        events.MapGet("", async (string? filter, string? city, ListEventsHandler handler, CancellationToken cancellationToken) =>
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

            return Results.Ok(await handler.HandleAsync(new ListEventsQuery(parsed, city), cancellationToken));
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

        events.MapPost("/{id:guid}/rsvps", async (Guid id, RsvpHandler handler, CancellationToken cancellationToken) =>
            (await handler.RsvpAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        events.MapDelete("/{id:guid}/rsvps/me", async (Guid id, RsvpHandler handler, CancellationToken cancellationToken) =>
            (await handler.CancelAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        events.MapGet("/{id:guid}/rsvps.csv", async (Guid id, RsvpHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, file) = await handler.ExportAsync(id, cancellationToken);
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
