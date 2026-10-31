using FaithTech.Community.Application.Admin;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Role assignment on profiles by definition id (L2-138). Both routes return the profile's held roles.</summary>
public static class RolesEndpoints
{
    public static IEndpointRouteBuilder MapRolesEndpoints(this IEndpointRouteBuilder app)
    {
        var roles = app.MapGroup("/api/profiles/{id:guid}/roles");

        roles.MapPost("", async (Guid id, AssignRoleCommand command, ChangeRolesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, updated) = await handler.AssignAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(updated));
        });

        roles.MapDelete("/{roleId:guid}", async (Guid id, Guid roleId, ChangeRolesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, updated) = await handler.RemoveAsync(id, roleId, cancellationToken);
            return result.ToHttp(() => Results.Ok(updated));
        });

        return app;
    }
}
