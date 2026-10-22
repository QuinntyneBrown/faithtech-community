using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Contacts;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Contacts;

public record AddContactNoteCommand(string? Body);

public record ContactNoteDto(Guid Id, string Body, DateTime CreatedAtUtc)
{
    public static ContactNoteDto From(ContactNote note) => new(note.Id, note.Body, note.CreatedAtUtc);
}

public class AddContactNoteValidator : AbstractValidator<AddContactNoteCommand>
{
    public AddContactNoteValidator()
    {
        RuleFor(x => x.Body).Cascade(CascadeMode.Stop)
            .Must(b => !string.IsNullOrWhiteSpace(b)).WithMessage("Write a note to save.")
            .Must(b => b!.Trim().Length <= ContactRules.MaxNote).WithMessage($"Use {ContactRules.MaxNote} characters or fewer for the note.");
    }
}

/// <summary>A contact's private notes (L2-014): same visibility as the contact, kept after linking.</summary>
public class ContactNotesHandler(IApplicationDbContext db, ContactAccess access, TimeProvider time)
{
    /// <summary>Newest first; null when the caller may not see the contact.</summary>
    public async Task<IReadOnlyList<ContactNoteDto>?> ListAsync(Guid contactId, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(contactId, cancellationToken: cancellationToken);
        if (contact is null)
        {
            return null;
        }

        access.AuditOverride(kind, actor, contact, "contact.notes-viewed");
        await db.SaveChangesAsync(cancellationToken);
        return await db.ContactNotes.AsNoTracking()
            .Where(n => n.ContactId == contactId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .Select(n => new ContactNoteDto(n.Id, n.Body, n.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<(Result Result, ContactNoteDto? Note)> AddAsync(Guid contactId, AddContactNoteCommand command, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(contactId, cancellationToken: cancellationToken);
        if (contact is null)
        {
            return (Result.NotFound(), null);
        }

        var note = contact.AddNote(command.Body!.Trim(), time.GetUtcNow().UtcDateTime);
        db.ContactNotes.Add(note);
        access.AuditOverride(kind, actor, contact, "contact.note-added");
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), ContactNoteDto.From(note));
    }
}
