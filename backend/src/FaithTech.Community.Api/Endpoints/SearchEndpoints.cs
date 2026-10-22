using FaithTech.Community.Application.Search;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Global search (L2-026). Signed-in members only; each sees only results they may open.</summary>
public static class SearchEndpoints
{
    public static IEndpointRouteBuilder MapSearchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/search", async (string? q, GlobalSearchHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, results) = await handler.SearchAsync(q, cancellationToken);
            return result.ToHttp(() => Results.Ok(results));
        });

        return app;
    }
}
