using System.Text.Json;
using FaithTech.Community.Application.Events;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Hub templates in Organisation settings (L2-184 to L2-186, ADR 0043): list, read, add, rename, choose sections, save a
/// section's default, archive and restore. The handler decides every permission.
/// </summary>
public static class HubTemplatesEndpoints
{
    public static IEndpointRouteBuilder MapHubTemplatesEndpoints(this IEndpointRouteBuilder app)
    {
        var templates = app.MapGroup("/api/hub-templates");

        templates.MapGet("", async (bool? archived, ManageHubTemplatesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.ListAsync(archived ?? false, cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        templates.MapGet("/{id:guid}", async (Guid id, ManageHubTemplatesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, template) = await handler.GetAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(template));
        });

        templates.MapPost("", async (HubTemplateNameCommand command, ManageHubTemplatesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, template) = await handler.AddAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Created($"/api/hub-templates/{template!.Id}", template));
        });

        templates.MapPut("/{id:guid}", async (
            Guid id, HubTemplateNameCommand command, ManageHubTemplatesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, template) = await handler.RenameAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(template));
        });

        templates.MapPut("/{id:guid}/sections", async (
            Guid id, HubTemplateSectionsCommand command, ManageHubTemplatesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, template) = await handler.SetSectionsAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(template));
        });

        templates.MapPut("/{id:guid}/sections/{kind}", async (
                Guid id, string kind, JsonElement content, ManageHubTemplatesHandler handler, CancellationToken cancellationToken) =>
            (await handler.SaveDefaultAsync(id, kind, content, cancellationToken)).ToHttp(Results.NoContent));

        templates.MapPost("/{id:guid}/archive", async (Guid id, ManageHubTemplatesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, template) = await handler.ArchiveAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(template));
        });

        templates.MapPost("/{id:guid}/restore", async (Guid id, ManageHubTemplatesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, template) = await handler.RestoreAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(template));
        });

        return app;
    }
}
