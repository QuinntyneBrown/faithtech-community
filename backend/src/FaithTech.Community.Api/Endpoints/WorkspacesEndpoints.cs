using FaithTech.Community.Application.Agile;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Agile workspaces and their members (L2-031, L2-050, L2-051). Access is decided by WorkspaceAccessPolicy.</summary>
public static class WorkspacesEndpoints
{
    public static IEndpointRouteBuilder MapWorkspacesEndpoints(this IEndpointRouteBuilder app)
    {
        var workspaces = app.MapGroup("/api/workspaces");

        workspaces.MapGet("", async (WorkspacesHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.ListAsync(cancellationToken)));

        workspaces.MapPost("", async (CreateWorkspaceCommand command, WorkspacesHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, workspace) = await handler.CreateAsync(command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/workspaces/{workspace!.Id}", workspace));
            })
            .Validate<CreateWorkspaceCommand>();

        workspaces.MapGet("/{id:guid}", async (Guid id, WorkspacesHandler handler, CancellationToken cancellationToken) =>
            await handler.GetAsync(id, cancellationToken) is { } workspace ? Results.Ok(workspace) : Results.NotFound());

        return app;
    }
}
