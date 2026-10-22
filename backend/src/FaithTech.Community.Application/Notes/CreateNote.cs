using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notes;

namespace FaithTech.Community.Application.Notes;

public record CreateNoteCommand(string? Title, Guid? ParentId);

/// <summary>
/// Creates a Private page owned by the caller (L2-085). Every signed-in member with a verified email may create
/// pages, Staff included (ADR 0025). A parent must be a page the caller owns (L2-091).
/// </summary>
public class CreateNoteHandler(IApplicationDbContext db, NoteAccess access, NoteViews views, TimeProvider time)
{
    public async Task<(Result Result, NotePageDto? Page)> HandleAsync(CreateNoteCommand command, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        if (await access.VerifiedAsync(caller, cancellationToken) is { } refused)
        {
            return (refused, null);
        }

        if (NoteFields.TitleError(command.Title) is { } error)
        {
            return (Result.Invalid("Title", error), null);
        }

        var page = new NotePage(caller, command.Title, null, time.GetUtcNow());
        db.NotePages.Add(page);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.DetailAsync(page, caller, cancellationToken));
    }
}

public static class NoteFields
{
    public static string? TitleError(string? title) =>
        title?.Trim().Length > NotePage.MaxTitle ? $"Use {NotePage.MaxTitle} characters or fewer for the title." : null;
}
