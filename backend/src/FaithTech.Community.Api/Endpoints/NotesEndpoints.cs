using FaithTech.Community.Application.Notes;
using Microsoft.AspNetCore.Mvc;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Docs &amp; notes (L2-085 to L2-099). Every endpoint needs a signed-in member; visibility and ownership are decided
/// by the handlers, and a page the caller may not open answers 404 (ADR 0025).
/// </summary>
public static class NotesEndpoints
{
    /// <summary>One 5 MB image, plus the form fields.</summary>
    private const long NoteImageLimit = Domain.Notes.NoteImage.MaxBytes + 1024 * 1024;

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

        notes.MapGet("/links", async (string? q, Guid? exclude, LinkSuggestionsHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.HandleAsync(q, exclude, cancellationToken)));

        notes.MapGet("/archived", async (ArchiveNoteHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.ListAsync(cancellationToken)));

        notes.MapPost("/{id:guid}/archive", async (Guid id, ArchiveNoteHandler handler, CancellationToken cancellationToken) =>
            (await handler.ArchiveAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        notes.MapPost("/{id:guid}/restore", async (Guid id, ArchiveNoteHandler handler, CancellationToken cancellationToken) =>
            (await handler.RestoreAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        notes.MapGet("/members", async (string? q, NoteMembersHandler handler, CancellationToken cancellationToken) =>
            Results.Ok(await handler.HandleAsync(q, cancellationToken)));

        notes.MapPut("/{id:guid}/visibility", async (Guid id, ShareNoteCommand command, ShareNoteHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, page) = await handler.HandleAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(page));
        });

        notes.MapGet("/{id:guid}/parent-options", async (Guid id, string? q, ParentOptionsHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(id, q, cancellationToken) is { } options ? Results.Ok(options) : Results.NotFound());

        notes.MapPut("/{id:guid}/parent", async (Guid id, MoveNoteCommand command, MoveNoteHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, page) = await handler.HandleAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(page));
        });

        notes.MapPost("/{id:guid}/images", async (Guid id, HttpRequest request, NoteImagesHandler handler, CancellationToken cancellationToken) =>
            {
                NoteImageUpload? upload = null;
                if (request.HasFormContentType)
                {
                    try
                    {
                        var form = await request.ReadFormAsync(cancellationToken);
                        if (form.Files.GetFile("file") is { } file)
                        {
                            upload = new NoteImageUpload(file.FileName, file.Length, file.OpenReadStream);
                        }
                    }
                    catch (InvalidDataException)
                    {
                        upload = null;
                    }
                }

                var (result, image, storageDown) = await handler.UploadAsync(id, upload, cancellationToken);
                return storageDown
                    ? Results.Problem("We couldn’t store the image. Try again in a minute.", statusCode: StatusCodes.Status503ServiceUnavailable)
                    : result.ToHttp(() => Results.Created($"/api/notes/{id}/images/{image!.ImageId}", image));
            })
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(NoteImageLimit), new RequestFormLimitsAttribute { MultipartBodyLengthLimit = NoteImageLimit });

        notes.MapGet("/{id:guid}/images/{imageId:guid}", async (Guid id, Guid imageId, HttpContext http, NoteImagesHandler handler, CancellationToken cancellationToken) =>
        {
            if (await handler.ReadAsync(id, imageId, cancellationToken) is not { } image)
            {
                return Results.NotFound();
            }

            http.Response.Headers.XContentTypeOptions = "nosniff";
            http.Response.Headers.CacheControl = "private, max-age=3600";
            return Results.File(image.Content, image.ContentType);
        });

        notes.MapGet("/{id:guid}", async (Guid id, GetNoteHandler handler, CancellationToken cancellationToken) =>
            await handler.HandleAsync(id, cancellationToken) is { } page ? Results.Ok(page) : Results.NotFound());

        notes.MapPut("/{id:guid}", async (Guid id, SaveNoteCommand command, SaveNoteHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, saved) = await handler.HandleAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(saved));
        });

        return app;
    }
}
