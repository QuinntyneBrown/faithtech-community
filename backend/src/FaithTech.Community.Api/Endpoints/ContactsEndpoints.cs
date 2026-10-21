using FaithTech.Community.Application.Contacts;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>
/// Private contacts (L2-012 to L2-016). Lead roles and System Admin only; another lead's contact answers 404 (ADR 0007).
/// </summary>
public static class ContactsEndpoints
{
    public static IEndpointRouteBuilder MapContactsEndpoints(this IEndpointRouteBuilder app)
    {
        var contacts = app.MapGroup("/api/contacts");

        contacts.MapGet("", async (string? q, ManageContactsHandler handler, CancellationToken cancellationToken) =>
            await handler.ListAsync(q, cancellationToken) is { } list ? Results.Ok(list) : Results.Forbid());

        contacts.MapGet("/archived", async (ManageContactsHandler handler, CancellationToken cancellationToken) =>
            await handler.ListArchivedAsync(cancellationToken) is { } list ? Results.Ok(list) : Results.Forbid());

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

        return app;
    }
}
