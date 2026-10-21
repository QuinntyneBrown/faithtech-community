using FaithTech.Community.Application.Agile;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Work items, their comments and the backlog (L2-032, L2-033). Access is decided by WorkspaceAccessPolicy.</summary>
public static class WorkItemsEndpoints
{
    public static IEndpointRouteBuilder MapWorkItemsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/workspaces/{id:guid}/items", async (
                Guid id, CreateWorkItemCommand command, WorkItemsHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, item) = await handler.CreateAsync(id, command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/items/{item!.Id}", item));
            })
            .Validate<CreateWorkItemCommand>();

        app.MapGet("/api/workspaces/{id:guid}/backlog", async (
                Guid id, Guid? initiativeId, Guid? epicId, bool? noEpic, WorkItemsHandler handler, CancellationToken cancellationToken) =>
            await handler.BacklogAsync(id, initiativeId, epicId, noEpic ?? false, cancellationToken) is { } tree ? Results.Ok(tree) : Results.NotFound());

        var items = app.MapGroup("/api/items");

        items.MapGet("/{id:guid}", async (Guid id, WorkItemsHandler handler, CancellationToken cancellationToken) =>
            await handler.GetAsync(id, cancellationToken) is { } item ? Results.Ok(item) : Results.NotFound());

        items.MapPut("/{id:guid}", async (Guid id, UpdateWorkItemCommand command, WorkItemsHandler handler, CancellationToken cancellationToken) =>
                (await handler.UpdateAsync(id, command, cancellationToken)).ToHttp(Results.NoContent))
            .Validate<UpdateWorkItemCommand>();

        items.MapPut("/{id:guid}/done", async (Guid id, SetDoneCommand command, WorkItemsHandler handler, CancellationToken cancellationToken) =>
            (await handler.SetDoneAsync(id, command, cancellationToken)).ToHttp(Results.NoContent));

        items.MapPost("/{id:guid}/comments", async (Guid id, AddCommentCommand command, WorkItemsHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, comment) = await handler.AddCommentAsync(id, command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/items/{id}", comment));
            })
            .Validate<AddCommentCommand>();

        return app;
    }
}
