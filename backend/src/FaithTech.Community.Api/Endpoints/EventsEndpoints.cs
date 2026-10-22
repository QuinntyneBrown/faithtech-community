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

        return app;
    }
}
