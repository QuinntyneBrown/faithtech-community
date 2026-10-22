using FaithTech.Community.Application.Search;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Global search for signed-in members (L2-026). Results are filtered by permission on the server.</summary>
public static class SearchEndpoints
{
    public static IEndpointRouteBuilder MapSearchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/search", async (string? q, GlobalSearchHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, results) = await handler.HandleAsync(q, cancellationToken);
            return result.ToHttp(() => Results.Ok(results));
        });

        return app;
    }
}
