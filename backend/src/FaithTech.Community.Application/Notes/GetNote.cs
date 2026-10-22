using FaithTech.Community.Application.Common;

namespace FaithTech.Community.Application.Notes;

/// <summary>The page at /notes/{id} (L2-086, L2-092): not found unless the caller may open it.</summary>
public class GetNoteHandler(NoteAccess access, NoteViews views)
{
    public async Task<NotePageDto?> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var page = await access.FindAsync(id, caller, cancellationToken);
        return page is null ? null : await views.DetailAsync(page, caller, cancellationToken);
    }
}
