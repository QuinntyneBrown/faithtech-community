using FaithTech.Community.Application.Notes;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Docs &amp; notes (L2-085 to L2-099). Every endpoint needs a signed-in member; visibility and ownership are decided
/// by the handlers, and a page the caller may not open answers 404 (ADR 0025).
/// </summary>
public static class NotesEndpoints
{
    public static IEndpointRouteBuilder MapNotesEndpoints(this IEndpointRouteBuilder app)
    {
        var notes = app.MapGroup("/api/notes");

        notes.MapGet("", async (string? q, string? owner, int? page, ListNotesHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, list) = await handler.HandleAsync(new ListNotesQuery(q, owner, page ?? 1), cancellationToken);
            return result.ToHttp(() => Results.Ok(list));
        });

        notes.MapPost("", async (CreateNoteCommand command, CreateNoteHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, created) = await handler.HandleAsync(command, cancellationToken);
            return result.ToHttp(() => Results.Created($"/api/notes/{created!.Id}", created));
        });

        notes.MapGet("/{id:guid}", async (Guid id, GetNoteHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(id, cancellationToken) is { } page ? Results.Ok(page) : Results.NotFound());

        return app;
    }
}
