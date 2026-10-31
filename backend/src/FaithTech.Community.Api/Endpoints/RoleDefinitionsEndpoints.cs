using FaithTech.Community.Application.Organisations;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The organisation's role definitions for the Roles page (L2-136). Archive and grant rules join in slice 17.</summary>
public static class RoleDefinitionsEndpoints
{
    public static IEndpointRouteBuilder MapRoleDefinitionsEndpoints(this IEndpointRouteBuilder app)
    {
        var roles = app.MapGroup("/api/organisation/roles");

        roles.MapGet("", async (bool? archived, ListRoleDefinitionsHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, definitions) = await handler.HandleAsync(archived ?? false, cancellationToken);
            return result.ToHttp(() => Results.Ok(definitions));
        });

        roles.MapPost("", async (RoleDefinitionCommand command, DefineRoleHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, definition) = await handler.HandleAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Created($"/api/organisation/roles/{definition!.Id}", definition));
        }).Validate<RoleDefinitionCommand>();

        roles.MapPut("/{id:guid}", async (Guid id, RoleDefinitionCommand command, UpdateRoleDefinitionHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, definition) = await handler.HandleAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(definition));
        }).Validate<RoleDefinitionCommand>();

        return app;
    }
}
