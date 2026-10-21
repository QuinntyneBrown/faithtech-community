using FaithTech.Community.Application.Team;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The team list for signed-in members (L2-019). Requires authentication like every route.</summary>
public static class TeamEndpoints
{
    public static IEndpointRouteBuilder MapTeamEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/team", async (ListTeamHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.HandleAsync(new ListTeamQuery(), cancellationToken)));

        return app;
    }
}
