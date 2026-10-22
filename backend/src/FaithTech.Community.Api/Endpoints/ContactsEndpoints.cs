using FaithTech.Community.Application.Contacts;
using FaithTech.Community.Application.Profiles;
using Microsoft.AspNetCore.Mvc;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Private contacts (L2-012 to L2-016). Lead roles and System Admin only; another lead's contact answers 404 (ADR 0014).
/// </summary>
public static class ContactsEndpoints
{
    private const long PhotoRequestLimit = 10 * 1024 * 1024;

    public static IEndpointRouteBuilder MapContactsEndpoints(this IEndpointRouteBuilder app)
    {
        var contacts = app.MapGroup("/api/contacts");

        contacts.MapGet("", async (string? q, ManageContactsHandler handler, CancellationToken cancellationToken) =>
            await handler.ListAsync(q, cancellationToken) is { } list ? Results.Ok(list) : Results.Forbid());

        contacts.MapGet("/archived", async (ManageContactsHandler handler, CancellationToken cancellationToken) =>
            await handler.ListArchivedAsync(cancellationToken) is { } list ? Results.Ok(list) : Results.Forbid());

        // Possible duplicate (L2-091): the caller's own contacts only. Mapped before "/{id:guid}"; the guid
        // constraint keeps "duplicates" from being read as an id.
        contacts.MapGet("/duplicates", async (string? email, Guid? excludeId, FindDuplicateContactHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, match) = await handler.FindAsync(new FindDuplicateContactQuery(email, excludeId), cancellationToken);
                return result.ToHttp(() => match is null ? Results.NoContent() : Results.Ok(match));
            });

        contacts.MapPost("", async (CreateContactCommand command, ManageContactsHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, contact) = await handler.CreateAsync(command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/contacts/{contact!.Id}", contact));
            })
            .Validate<CreateContactCommand>();

        contacts.MapGet("/{id:guid}", async (Guid id, ManageContactsHandler handler, CancellationToken cancellationToken) =>
            await handler.GetAsync(id, cancellationToken) is { } contact ? Results.Ok(contact) : Results.NotFound());

        contacts.MapPut("/{id:guid}", async (Guid id, UpdateContactCommand command, ManageContactsHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, contact) = await handler.UpdateAsync(id, command, cancellationToken);
                return result.ToHttp(() => Results.Ok(contact));
            })
            .Validate<UpdateContactCommand>();

        contacts.MapGet("/{id:guid}/notes", async (Guid id, ContactNotesHandler handler, CancellationToken cancellationToken) =>
            await handler.ListAsync(id, cancellationToken) is { } notes ? Results.Ok(notes) : Results.NotFound());

        contacts.MapPost("/{id:guid}/notes", async (Guid id, AddContactNoteCommand command, ContactNotesHandler handler, CancellationToken cancellationToken) =>
            {
                var (result, note) = await handler.AddAsync(id, command, cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/contacts/{id}/notes", note));
            })
            .Validate<AddContactNoteCommand>();

        contacts.MapPost("/{id:guid}/archive", async (Guid id, ArchiveContactsHandler handler, CancellationToken cancellationToken) =>
            (await handler.ArchiveAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        contacts.MapPost("/{id:guid}/restore", async (Guid id, ArchiveContactsHandler handler, CancellationToken cancellationToken) =>
            (await handler.RestoreAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        contacts.MapDelete("/{id:guid}", async (Guid id, ArchiveContactsHandler handler, CancellationToken cancellationToken) =>
            (await handler.DeleteAsync(id, cancellationToken)).ToHttp(Results.NoContent));

        contacts.MapPost("/{id:guid}/link", async (Guid id, LinkContactCommand command, LinkContactHandler handler, CancellationToken cancellationToken) =>
        {
            var (result, contact) = await handler.LinkAsync(id, command, cancellationToken);
            return result.ToHttp(() => Results.Ok(contact));
        });

        // Contact photos (L2-067 to L2-071). Bearer-token API, so no antiforgery; up to 10 MB is read so a
        // too-large photo gets the inline 400.
        contacts.MapPost("/{id:guid}/photos", async (
                Guid id, IFormFile? file, [FromForm] string? altText, ContactPhotosHandler handler, CancellationToken cancellationToken) =>
            {
                if (file is null)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["File"] = ["Choose a photo to upload."] });
                }

                await using var content = file.OpenReadStream();
                var (result, photo) = await handler.UploadAsync(
                    id, new UploadPhotoCommand(content, file.FileName, file.Length, altText), cancellationToken);
                return result.ToHttp(() => Results.Created($"/api/contacts/{id}", photo));
            })
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(PhotoRequestLimit), new RequestFormLimitsAttribute { MultipartBodyLengthLimit = PhotoRequestLimit });

        // The only way to see a contact photo: the bearer token is required and anyone but the owner and System Admin
        // gets 404, so a copied URL shows nothing to anyone else (ADR 0017).
        contacts.MapGet("/{id:guid}/photos/{photoId:guid}/image", async (
                Guid id, Guid photoId, HttpContext http, ContactPhotosHandler handler, CancellationToken cancellationToken) =>
            {
                if (await handler.ReadImageAsync(id, photoId, cancellationToken) is not { } image)
                {
                    return Results.NotFound();
                }

                http.Response.Headers.CacheControl = "private, max-age=300";
                return Results.File(image.Content, image.ContentType);
            });

        contacts.MapPut("/{id:guid}/photos/{photoId:guid}", async (
                Guid id, Guid photoId, DescribePhotoCommand command, ContactPhotosHandler handler, CancellationToken cancellationToken) =>
            (await handler.DescribeAsync(id, photoId, command, cancellationToken)).ToHttp(Results.NoContent));

        contacts.MapPut("/{id:guid}/photos/{photoId:guid}/featured", async (
                Guid id, Guid photoId, ContactPhotosHandler handler, CancellationToken cancellationToken) =>
            (await handler.FeatureAsync(id, photoId, cancellationToken)).ToHttp(Results.NoContent));

        contacts.MapDelete("/{id:guid}/photos/{photoId:guid}", async (
                Guid id, Guid photoId, ContactPhotosHandler handler, CancellationToken cancellationToken) =>
            (await handler.DeleteAsync(id, photoId, cancellationToken)).ToHttp(Results.NoContent));

        return app;
    }
}
