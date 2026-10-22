using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notes;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

public record MoveNoteCommand(Guid? ParentId);

/// <summary>
/// Puts a page inside another page of the same owner, or at the top level (L2-091 AC4, AC5). Never under itself
/// or one of its descendants, and never under an archived page.
/// </summary>
public class MoveNoteHandler(IApplicationDbContext db, NoteAccess access, NoteViews views, IAuditLog audit)
{
    public async Task<(Result Result, NotePageDto? Page)> HandleAsync(Guid id, MoveNoteCommand command, CancellationToken cancellationToken = default)
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
            return (Result.Invalid("ParentId", NoteFields.ArchivedMessage), null);
        }

        if (command.ParentId is { } parentId)
        {
            var parent = await access.FindAsync(parentId, caller, cancellationToken);
            if (parent is null)
            {
                return (Result.NotFound(), null);
            }

            var descendants = await DescendantsAsync(db, page.Id, cancellationToken);
            if (parent.OwnerId != page.OwnerId || parent.IsArchived || parent.Id == page.Id || descendants.Contains(parent.Id))
            {
                return (Result.Invalid("ParentId", NoteFields.ParentMessage), null);
            }
        }

        if (access.IsOverride(page, caller))
        {
            audit.Record(caller, "note.moved", nameof(NotePage), page.Id.ToString(), new { page.ParentId }, new { command.ParentId });
        }

        page.MoveTo(command.ParentId);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.DetailAsync(page, caller, cancellationToken));
    }

    /// <summary>Every page below the given one, at any depth.</summary>
    public static async Task<HashSet<Guid>> DescendantsAsync(IApplicationDbContext db, Guid pageId, CancellationToken cancellationToken)
    {
        var found = new HashSet<Guid>();
        var frontier = new List<Guid> { pageId };
        while (frontier.Count > 0)
        {
            var next = await db.NotePages.AsNoTracking().Where(p => p.ParentId != null && frontier.Contains(p.ParentId.Value))
                .Select(p => p.Id).ToListAsync(cancellationToken);
            frontier = [.. next.Where(found.Add)];
        }

        return found;
    }
}

/// <summary>The move dialog's choices (L2-091 AC3): the owner's active pages but this one and its descendants.</summary>
public class ParentOptionsHandler(IApplicationDbContext db, NoteAccess access)
{
    public const int Limit = 50;

    public async Task<IReadOnlyList<NotePageRefDto>?> HandleAsync(Guid id, string? q, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var page = await access.FindAsync(id, caller, cancellationToken);
        if (page is null)
        {
            return null;
        }

        var excluded = await MoveNoteHandler.DescendantsAsync(db, page.Id, cancellationToken);
        excluded.Add(page.Id);
        var excludedList = excluded.ToList();
        var options = db.NotePages.AsNoTracking().Where(p => p.OwnerId == page.OwnerId && p.ArchivedAt == null && !excludedList.Contains(p.Id));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            options = options.Where(p => p.Title.ToLower().Contains(term));
        }

        return await options.OrderBy(p => p.Title).ThenBy(p => p.Id).Take(Limit)
            .Select(p => new NotePageRefDto(p.Id, p.Title == "" ? NoteRefs.Untitled : p.Title, p.Icon))
            .ToListAsync(cancellationToken);
    }
}

/// <summary>The "[[" suggestions (L2-090 AC1): up to 10 pages the caller may open, by title, most recently edited first.</summary>
public class LinkSuggestionsHandler(IApplicationDbContext db, NoteAccess access)
{
    public const int Limit = 10;

    public async Task<IReadOnlyList<NotePageRefDto>> HandleAsync(string? q, Guid? exclude, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var pages = access.Visible(db.NotePages.AsNoTracking(), caller);
        if (exclude is { } id)
        {
            pages = pages.Where(p => p.Id != id);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            pages = pages.Where(p => p.Title.ToLower().Contains(term));
        }

        return await pages.OrderByDescending(p => p.UpdatedAt).ThenBy(p => p.Id).Take(Limit)
            .Select(p => new NotePageRefDto(p.Id, p.Title == "" ? NoteRefs.Untitled : p.Title, p.Icon))
            .ToListAsync(cancellationToken);
    }
}
