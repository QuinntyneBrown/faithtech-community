using FaithTech.Community.Application.Admin;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Role assignment on profiles (L2-008, L2-009). Both routes return the profile's new role set.</summary>
public static class RolesEndpoints
{
    public static IEndpointRouteBuilder MapRolesEndpoints(this IEndpointRouteBuilder app)
    {
        var roles = app.MapGroup("/api/profiles/{id:guid}/roles");

        roles.MapPost("", async (Guid id, AssignRoleCommand command, ChangeRolesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, updated) = await handler.AssignAsync(id, command.Role, cancellationToken);
            return result.ToHttp(() => Results.Ok(updated));
        });

        roles.MapDelete("/{role}", async (Guid id, string role, ChangeRolesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, updated) = await handler.RemoveAsync(id, role, cancellationToken);
            return result.ToHttp(() => Results.Ok(updated));
        });

        return app;
    }
}
