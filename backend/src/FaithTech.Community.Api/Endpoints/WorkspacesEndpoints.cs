using FaithTech.Community.Application.Agile;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Agile workspaces, their members and sprints (L2-031, L2-035, L2-050, L2-051). Access is decided by WorkspaceAccessPolicy.</summary>
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

        workspaces.MapPut("/{id:guid}", async (Guid id, RenameWorkspaceCommand command, WorkspaceSettingsHandler handler, CancellationToken cancellationToken) =>
                (await handler.RenameAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<RenameWorkspaceCommand>();

        workspaces.MapGet("/candidates", async (WorkspaceSettingsHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, candidates) = await handler.CandidatesAsync(null, cancellationToken);
            return result.ToHttp(() => Results.Ok(candidates));
        });

        workspaces.MapGet("/{id:guid}/candidates", async (Guid id, WorkspaceSettingsHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, candidates) = await handler.CandidatesAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(candidates));
        });

        workspaces.MapPost("/{id:guid}/members", async (
                Guid id, AddWorkspaceMembersCommand command, WorkspaceSettingsHandler handler, CancellationToken cancellationToken) =>
                (await handler.AddMembersAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<AddWorkspaceMembersCommand>();

        workspaces.MapDelete("/{id:guid}/members/{profileId:guid}", async (
                Guid id, Guid profileId, WorkspaceSettingsHandler handler, CancellationToken cancellationToken) =>
            (await handler.RemoveMemberAsync(id, profileId, cancellationToken)).ToHttp(Results.NoContent));

        workspaces.MapGet("/{id:guid}/sprints", async (Guid id, SprintsHandler handler, CancellationToken cancellationToken) =>
            await handler.GetAsync(id, cancellationToken) is { } sprints ? Results.Ok(sprints) : Results.NotFound());

        workspaces.MapPost("/{id:guid}/sprints", async (Guid id, StartSprintCommand command, SprintsHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, sprintId) = await handler.StartAsync(id, command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/workspaces/{id}/sprints", new { Id = sprintId }));
            })
            .Validate<StartSprintCommand>();

        workspaces.MapPost("/{id:guid}/sprints/{sprintId:guid}/stories", async (
                Guid id, Guid sprintId, AddStoriesToSprintCommand command, SprintsHandler handler, CancellationToken cancellationToken) =>
                (await handler.AddStoriesAsync(id, sprintId, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<AddStoriesToSprintCommand>();

        workspaces.MapPost("/{id:guid}/sprints/{sprintId:guid}/close", async (
                Guid id, Guid sprintId, SprintsHandler handler, CancellationToken cancellationToken) =>
            (await handler.CloseAsync(id, sprintId, cancellationToken)).ToHttp(Results.NoContent));

        return app;
    }
}
