using FaithTech.Community.Application.Profiles;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Profiles for signed-in members (L2-005, L2-006, L2-007). Every route requires authentication.</summary>
public static class ProfilesEndpoints
{
    public static IEndpointRouteBuilder MapProfilesEndpoints(this IEndpointRouteBuilder app)
    {
        var profiles = app.MapGroup("/api/profiles");

        profiles.MapGet("/me", async (GetProfileHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleOwnAsync(cancellationToken) is { } profile ? Results.Ok(profile) : Results.NotFound());

        profiles.MapGet("/{id:guid}", async (Guid id, GetProfileHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(id, cancellationToken) is { } profile ? Results.Ok(profile) : Results.NotFound());

        return app;
    }
}
