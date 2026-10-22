using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Search;
using FaithTech.Community.Domain.Notes;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

/// <summary>
/// The Notes group of global search (L2-096): pages the caller may open, never archived ones, matched on the title
/// and the text derived from the blocks on save, which never holds a linked page's title (ADR 0023, ADR 0025).
/// </summary>
public class NotesSearchSource(IApplicationDbContext db, IFullTextSearch text, NoteAccess access) : ISearchSource
{
    public SearchResultKind Kind => SearchResultKind.Note;

    public async Task<IReadOnlyList<SearchResultItem>> SearchAsync(string term, Guid caller, int limit, CancellationToken cancellationToken = default)
    {
        var roles = access.Roles;
        var rows = await text
            .Match(access.Visible(db.NotePages.AsNoTracking(), caller), term, ListNotesHandler.Document)
            .Take(limit)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Icon,
                p.BodyText,
                p.Visibility,
                p.OwnerId,
                p.UpdatedAt,
                Owner = db.Profiles.Where(x => x.Id == p.OwnerId).Select(x => x.Name).FirstOrDefault(),
                SharedWithCaller = p.SharedMembers.Any(m => m.ProfileId == caller) || p.SharedRoles.Any(x => roles.Contains(x.Role)),
            })
            .ToListAsync(cancellationToken);
        return [.. rows.Select(r => new SearchResultItem(
            r.Id,
            (r.Icon is null ? "" : r.Icon + " ") + NoteRefs.TitleOf(r.Title),
            Snippets.Join(r.OwnerId == caller ? "you" : r.Owner, $"edited {r.UpdatedAt:ddd d MMM}", Excerpt(term, r.Title, r.BodyText)),
            $"/notes/{r.Id}",
            Badge: r.Visibility switch
            {
                NoteVisibility.Private => "Private",
                NoteVisibility.Shared when r.OwnerId != caller && r.SharedWithCaller => "Shared with you",
                NoteVisibility.Shared => "Shared",
                _ => null,
            }))];
    }

    /// <summary>The words around the match when it is in the text, not the title (L2-096 AC1).</summary>
    private static string? Excerpt(string term, string title, string body)
    {
        var word = term.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
        if (title.Contains(word, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var at = body.IndexOf(word, StringComparison.OrdinalIgnoreCase);
        if (at < 0)
        {
            return null;
        }

        var start = Math.Max(0, at - 40);
        var excerpt = body.Substring(start, Math.Min(body.Length - start, 120)).Replace('\n', ' ').Trim();
        return (start > 0 ? "…" : "") + excerpt + (start + 120 < body.Length ? "…" : "");
    }
}
