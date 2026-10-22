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
public class SaveNoteHandler(IApplicationDbContext db, NoteAccess access, NoteRefs refs, TimeProvider time)
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

        if (page.IsArchived)
        {
            return (Result.Invalid("Version", NoteFields.ArchivedMessage), null);
        }

        // Optimistic concurrency (ADR 0023): a save based on an older version never overwrites a newer one.
        if (command.Version != page.Version)
        {
            return (await ConflictAsync(page, caller, cancellationToken), null);
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

        // A page link already on the page stays; a new one must point at a page the saver may open (L2-090 AC4).
        var targets = NoteRefs.LinkedIds(blocks).ToList();
        var existing = NoteRefs.LinkedIds(NoteContent.Read(page.Content)).ToHashSet();
        var added = targets.Where(t => !existing.Contains(t)).ToList();
        if (added.Count > 0 && (await refs.VisibleAsync(added, caller, cancellationToken)).Count != added.Count)
        {
            errors["Blocks"] = [LinkMessage];
        }

        if (errors.Count > 0)
        {
            return (new Result(ResultStatus.Invalid, errors), null);
        }

        blocks = WithoutLinkText(blocks);
        await RebuildLinksAsync(page.Id, targets, cancellationToken);
        page.Save(command.Title ?? string.Empty, command.Icon, NoteContent.Write(blocks), NoteBlocksValidator.BodyText(blocks), caller, time.GetUtcNow());
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another save won the race between the version check and this write.
            var current = await db.NotePages.AsNoTracking().SingleAsync(p => p.Id == id, cancellationToken);
            return (await ConflictAsync(current, caller, cancellationToken), null);
        }

        return (Result.Ok(), new NoteSavedDto(page.Version, page.UpdatedAt));
    }

    public const string ConflictMessage = "This page changed somewhere else.";

    /// <summary>The 409 (L2-094 AC2): the current version, who saved it and when.</summary>
    private async Task<Result> ConflictAsync(NotePage page, Guid caller, CancellationToken cancellationToken)
    {
        var name = await db.Profiles.Where(p => p.Id == page.UpdatedById).Select(p => p.Name).FirstOrDefaultAsync(cancellationToken);
        return Result.Conflict(ConflictMessage, new Dictionary<string, object?>
        {
            ["currentVersion"] = page.Version,
            ["updatedByName"] = name ?? NoteViews.FormerMember,
            ["updatedByYou"] = page.UpdatedById == caller,
            ["updatedAt"] = page.UpdatedAt,
        });
    }

    public const string LinkMessage = "Link to a page you can open.";

    /// <summary>Page links are stored without text, so a title never sits in another page (ADR 0025).</summary>
    private static List<NoteBlock> WithoutLinkText(IReadOnlyList<NoteBlock> blocks) =>
        [.. blocks.Select(b => b.Text is null ? b : b with { Text = [.. b.Text.Select(s => s.PageId is null ? s : s with { Text = "" })] })];

    /// <summary>The page's links, rebuilt from the saved blocks: existing targets other than the page itself.</summary>
    private async Task RebuildLinksAsync(Guid pageId, IReadOnlyCollection<Guid> targets, CancellationToken cancellationToken)
    {
        var old = await db.NoteLinks.Where(l => l.SourceId == pageId).ToListAsync(cancellationToken);
        db.NoteLinks.RemoveRange(old.Where(l => !targets.Contains(l.TargetId)));
        var ids = targets.Where(t => t != pageId && old.All(l => l.TargetId != t)).ToList();
        var real = await db.NotePages.Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync(cancellationToken);
        db.NoteLinks.AddRange(real.Select(t => new NoteLink(pageId, t)));
    }
}
