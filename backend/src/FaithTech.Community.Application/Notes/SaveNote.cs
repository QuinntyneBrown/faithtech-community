using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notes;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

public record SaveNoteCommand(string? Title, string? Icon, IReadOnlyList<NoteBlock>? Blocks, int Version);

public record NoteSavedDto(int Version, DateTimeOffset UpdatedAt);

/// <summary>
/// A whole-page save (L2-086 AC8, ADR 0023): the title, icon and the full ordered block list replace the stored
/// ones. Only the owner or a System Admin; everyone else who can read the page is refused.
/// </summary>
public class SaveNoteHandler(IApplicationDbContext db, NoteAccess access, TimeProvider time)
{
    public async Task<(Result Result, NoteSavedDto? Saved)> HandleAsync(Guid id, SaveNoteCommand command, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var page = await access.FindAsync(id, caller, cancellationToken);
        if (page is null)
        {
            return (Result.NotFound(), null);
        }

        if (!access.CanChange(page, caller))
        {
            return (Result.Forbidden(), null);
        }

        var blocks = command.Blocks ?? [];
        var errors = NoteBlocksValidator.Check(blocks);
        if (NoteFields.TitleError(command.Title) is { } titleError)
        {
            errors["Title"] = [titleError];
        }

        if (command.Icon is { Length: > 0 } icon && !NoteFields.IsEmoji(icon))
        {
            errors["Icon"] = ["Choose a single emoji for the icon."];
        }

        if (errors.Count > 0)
        {
            return (new Result(ResultStatus.Invalid, errors), null);
        }

        page.Save(command.Title ?? string.Empty, command.Icon, NoteContent.Write(blocks), NoteBlocksValidator.BodyText(blocks), caller, time.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), new NoteSavedDto(page.Version, page.UpdatedAt));
    }
}
