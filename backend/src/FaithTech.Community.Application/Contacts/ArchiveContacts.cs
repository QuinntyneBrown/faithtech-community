using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Contacts;

/// <summary>Archive (soft delete), restore and permanent delete of private contacts (L2-016).</summary>
public class ArchiveContactsHandler(IApplicationDbContext db, ContactAccess access, TimeProvider time)
{
    public async Task<Result> ArchiveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(id, cancellationToken: cancellationToken);
        if (contact is null)
        {
            return Result.NotFound();
        }

        if (contact.IsArchived)
        {
            return Result.Conflict("The contact is already archived.");
        }

        contact.Archive(time.GetUtcNow().UtcDateTime);
        access.AuditOverride(kind, actor, contact, "contact.archived");
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    public async Task<Result> RestoreAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(id, cancellationToken: cancellationToken);
        if (contact is null)
        {
            return Result.NotFound();
        }

        if (!contact.IsArchived)
        {
            return Result.Conflict("The contact is not archived.");
        }

        contact.Restore();
        access.AuditOverride(kind, actor, contact, "contact.restored");
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    /// <summary>Only an archived contact can be deleted; its notes go with it.</summary>
    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var (kind, contact, actor) = await access.AuthorizeAsync(id, withNotes: true, cancellationToken);
        if (contact is null)
        {
            return Result.NotFound();
        }

        if (!contact.CanBeDeleted)
        {
            return Result.Conflict("Archive the contact before deleting it.");
        }

        db.Contacts.Remove(contact);
        access.AuditOverride(kind, actor, contact, "contact.deleted");
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
