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

        if (command.ParentId is { } parentId)
        {
            var parent = await access.FindAsync(parentId, caller, cancellationToken);
            if (parent is null)
            {
                return (Result.NotFound(), null);
            }

            if (parent.OwnerId != caller || parent.IsArchived)
            {
                return (Result.Invalid("ParentId", NoteFields.ParentMessage), null);
            }
        }

        var page = new NotePage(caller, command.Title, command.ParentId, time.GetUtcNow());
        db.NotePages.Add(page);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.DetailAsync(page, caller, cancellationToken));
    }
}

public static class NoteFields
{
    public const string ParentMessage = "Choose another page.";
    public const string ArchivedMessage = "Restore this page before you change it.";

    /// <summary>One emoji: a single user-perceived character that is a symbol (L2-086 AC3, L2-087 AC6).</summary>
    public static bool IsEmoji(string value)
    {
        if (value.Length > NotePage.MaxIcon || new System.Globalization.StringInfo(value).LengthInTextElements != 1)
        {
            return false;
        }

        var first = System.Text.Rune.GetRuneAt(value, 0);
        return System.Text.Rune.GetUnicodeCategory(first) is System.Globalization.UnicodeCategory.OtherSymbol
            || first.Value >= 0x1F000;
    }

    public static string? TitleError(string? title) =>
        title?.Trim().Length > NotePage.MaxTitle ? $"Use {NotePage.MaxTitle} characters or fewer for the title." : null;
}
