using FaithTech.Community.Application.Profiles;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The people directory (L2-053) for City Leads, Staff and System Admins. Requires authentication.</summary>
public static class PeopleEndpoints
{
    public static IEndpointRouteBuilder MapPeopleEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/people", async (string? q, int? page, ListPeopleHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(q, page ?? 1, cancellationToken) is { } result ? Results.Ok(result) : Results.Forbid());

        return app;
    }
}
