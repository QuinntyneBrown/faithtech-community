using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notes;

namespace FaithTech.Community.Application.Notes;

/// <summary>
/// The page at /notes/{id} (L2-086, L2-092): not found unless the caller may open it. A System Admin opening a
/// Private or Shared page they do not own is audited (L2-098 AC6).
/// </summary>
public class GetNoteHandler(IApplicationDbContext db, NoteAccess access, NoteViews views, IAuditLog audit)
{
    public async Task<NotePageDto?> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var page = await access.FindAsync(id, caller, cancellationToken);
        if (page is null)
        {
            return null;
        }

        if (access.IsOverride(page, caller) && (page.Visibility != NoteVisibility.Global || page.IsArchived))
        {
            audit.Record(caller, "note.opened", nameof(NotePage), page.Id.ToString(), null, new { page.Title, Visibility = page.Visibility.ToString() });
            await db.SaveChangesAsync(cancellationToken);
        }

        return await views.DetailAsync(page, caller, cancellationToken);
    }
}
