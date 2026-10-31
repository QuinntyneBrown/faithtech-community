using FaithTech.Community.Application.Organisations;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>The Chapters tab: list, add, rename, reorder and archive (L2-140 AC3 to AC5, AC7).</summary>
public static class ChaptersEndpoints
{
    public static IEndpointRouteBuilder MapChaptersEndpoints(this IEndpointRouteBuilder app)
    {
        var chapters = app.MapGroup("/api/organisation/chapters");

        chapters.MapGet("", async (bool? archived, ListChaptersHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.HandleAsync(archived ?? false, cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        chapters.MapPost("", async (ChapterNameCommand command, ManageChaptersHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, chapter) = await handler.AddAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Created($"/api/organisation/chapters/{chapter!.Id}", chapter));
        }).Validate<ChapterNameCommand>();

        chapters.MapPut("/order", async (ReorderChaptersCommand command, ManageChaptersHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.ReorderAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        chapters.MapPut("/{id:guid}", async (Guid id, ChapterNameCommand command, ManageChaptersHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, chapter) = await handler.RenameAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(chapter));
        }).Validate<ChapterNameCommand>();

        chapters.MapPost("/{id:guid}/archive", async (Guid id, ManageChaptersHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, chapter) = await handler.ArchiveAsync(id, cancellationToken);
            return result.ToHttp(() => Results.Ok(chapter));
        });

        return app;
    }
}
