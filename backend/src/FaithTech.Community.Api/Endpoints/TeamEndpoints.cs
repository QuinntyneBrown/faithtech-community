using FaithTech.Community.Application.Team;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The team list for signed-in members (L2-019). Requires authentication like every route.</summary>
public static class TeamEndpoints
{
    public static IEndpointRouteBuilder MapTeamEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/team", async (string? role, string? city, string? after, int? pageSize, ListTeamHandler handler, CancellationToken cancellationToken) =>
        {
            TeamRoleFilter? filter = null;
            if (!string.IsNullOrEmpty(role))
            {
                // Names only: Enum.TryParse would also accept numbers such as "7".
                if (!Enum.GetNames<TeamRoleFilter>().Contains(role, StringComparer.OrdinalIgnoreCase))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["role"] = ["Filter by Leads or Volunteers."] });
                }

                filter = Enum.Parse<TeamRoleFilter>(role, ignoreCase: true);
            }

            return await handler.HandleAsync(new ListTeamQuery(filter, city, after, pageSize), cancellationToken) is { } page
                ? Results.Ok(page)
                : Results.ValidationProblem(new Dictionary<string, string[]> { ["after"] = ["That page link is out of date. Reload the list."] });
        });

        return app;
    }
}
