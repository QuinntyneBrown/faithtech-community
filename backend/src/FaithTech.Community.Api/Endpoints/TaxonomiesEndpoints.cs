using FaithTech.Community.Application.Organisations;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Stages &amp; types: the partner stages' list, add, rename, set initial, set kind, reorder and archive (L2-144 AC1), and the
/// event types' list, add, rename, reorder and archive (L2-145 AC1).
/// </summary>
public static class TaxonomiesEndpoints
{
    public static IEndpointRouteBuilder MapTaxonomiesEndpoints(this IEndpointRouteBuilder app)
    {
        var stages = app.MapGroup("/api/organisation/partner-stages");

        stages.MapGet("", async (bool? archived, ManagePartnerStagesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.ListAsync(archived ?? false, cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        stages.MapPost("", async (TaxonomyNameCommand command, ManagePartnerStagesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, stage) = await handler.AddAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Created($"/api/organisation/partner-stages/{stage!.Id}", stage));
        }).Validate<TaxonomyNameCommand>();

        stages.MapPut("/order", async (ReorderTaxonomyCommand command, ManagePartnerStagesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.ReorderAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        stages.MapPut("/{id:guid}", async (Guid id, PartnerStageCommand command, ManagePartnerStagesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, stage) = await handler.UpdateAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(stage));
        }).Validate<PartnerStageCommand>();

        stages.MapPost("/{id:guid}/archive", async (Guid id, ManagePartnerStagesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, stage) = await handler.ArchiveAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(stage));
        });

        var types = app.MapGroup("/api/organisation/event-types");

        types.MapGet("", async (bool? archived, ManageEventTypesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.ListAsync(archived ?? false, cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        types.MapPost("", async (TaxonomyNameCommand command, ManageEventTypesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, type) = await handler.AddAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Created($"/api/organisation/event-types/{type!.Id}", type));
        }).Validate<TaxonomyNameCommand>();

        types.MapPut("/order", async (ReorderTaxonomyCommand command, ManageEventTypesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.ReorderAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        types.MapPut("/{id:guid}", async (Guid id, TaxonomyNameCommand command, ManageEventTypesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, type) = await handler.RenameAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(type));
        }).Validate<TaxonomyNameCommand>();

        types.MapPost("/{id:guid}/archive", async (Guid id, ManageEventTypesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, type) = await handler.ArchiveAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(type));
        });

        return app;
    }
}
