using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notes;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

/// <summary>An archived page as the Archived page lists it (L2-095 AC3).</summary>
public record ArchivedNoteDto(Guid Id, string Title, string? Icon, DateTimeOffset ArchivedAt);

/// <summary>
/// Archive and restore (L2-095): the owner or a System Admin. An archived page is hidden from everyone else, so
/// restoring one you cannot see is not found; its child pages are untouched.
/// </summary>
public class ArchiveNoteHandler(IApplicationDbContext db, NoteAccess access, IAuditLog audit, TimeProvider time)
{
    public Task<Result> ArchiveAsync(Guid id, CancellationToken cancellationToken = default) =>
        ChangeAsync(id, archive: true, cancellationToken);

    public Task<Result> RestoreAsync(Guid id, CancellationToken cancellationToken = default) =>
        ChangeAsync(id, archive: false, cancellationToken);

    /// <summary>The caller's own archived pages, most recently archived first.</summary>
    public async Task<IReadOnlyList<ArchivedNoteDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        return await db.NotePages.AsNoTracking()
            .Where(p => p.OwnerId == caller && p.ArchivedAt != null)
            .OrderByDescending(p => p.ArchivedAt)
            .Select(p => new ArchivedNoteDto(p.Id, p.Title == "" ? NoteRefs.Untitled : p.Title, p.Icon, p.ArchivedAt!.Value))
            .ToListAsync(cancellationToken);
    }

    private async Task<Result> ChangeAsync(Guid id, bool archive, CancellationToken cancellationToken)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var page = await access.FindAsync(id, caller, cancellationToken);
        if (page is null)
        {
            return Result.NotFound();
        }

        if (!access.CanChange(page, caller))
        {
            return Result.Forbidden();
        }

        if (page.IsArchived == archive)
        {
            return Result.Conflict(archive ? "It’s already archived." : "It isn’t archived.");
        }

        if (archive)
        {
            page.Archive(time.GetUtcNow());
        }
        else
        {
            page.Restore();
        }

        if (access.IsOverride(page, caller))
        {
            audit.Record(caller, archive ? "note.archived" : "note.restored", nameof(NotePage), page.Id.ToString(), null, new { page.Title });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }
}
