using FaithTech.Community.Application.Organisations;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The organisation's role definitions for the Roles page: list, define, edit, grant rules and archive (L2-136, L2-137).</summary>
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

        roles.MapPut("/{id:guid}/grants", async (Guid id, GrantRulesCommand command, SetGrantRulesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, definition) = await handler.HandleAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(definition));
        });

        roles.MapPost("/{id:guid}/archive", async (Guid id, ArchiveRoleDefinitionHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, definition) = await handler.HandleAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(definition));
        });

        return app;
    }
}
