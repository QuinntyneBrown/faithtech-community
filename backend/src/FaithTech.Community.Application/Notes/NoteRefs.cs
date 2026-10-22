using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Notes;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

/// <summary>
/// Names the pages a page points at, as the caller may see them (L2-090, L2-091, ADR 0025): a page the caller may
/// open by its title and icon, any other as "Private page" with no id, so no title or icon ever leaks.
/// </summary>
public class NoteRefs(IApplicationDbContext db, NoteAccess access)
{
    public const string PrivatePage = "Private page";
    public const string Untitled = "Untitled";

    public static NotePageRefDto Private => new(null, PrivatePage, null);

    /// <summary>The pages among <paramref name="ids"/> the caller may open, by id.</summary>
    public async Task<Dictionary<Guid, NotePageRefDto>> VisibleAsync(IReadOnlyCollection<Guid> ids, Guid caller, CancellationToken cancellationToken)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        var list = ids.ToList();
        var rows = await access.Visible(db.NotePages.AsNoTracking(), caller).Where(p => list.Contains(p.Id))
            .Select(p => new { p.Id, p.Title, p.Icon })
            .ToListAsync(cancellationToken);
        return rows.ToDictionary(r => r.Id, r => new NotePageRefDto(r.Id, TitleOf(r.Title), r.Icon));
    }

    public static string TitleOf(string title) => string.IsNullOrWhiteSpace(title) ? Untitled : title;

    public static IEnumerable<Guid> LinkedIds(IEnumerable<NoteBlock> blocks) =>
        blocks.SelectMany(b => b.Text ?? []).Where(s => s.PageId is not null).Select(s => s.PageId!.Value).Distinct();

    /// <summary>The blocks with each page link's text set to what the caller may see.</summary>
    public static IReadOnlyList<NoteBlock> Resolve(IReadOnlyList<NoteBlock> blocks, IReadOnlyDictionary<Guid, NotePageRefDto> visible) =>
        [.. blocks.Select(b => b.Text is null ? b : b with
        {
            Text = [.. b.Text.Select(s => s.PageId is { } id ? s with { Text = visible.TryGetValue(id, out var target) ? target.Title : PrivatePage } : s)],
        })];

    /// <summary>The ancestors from the top-level page down; ones the caller may not open read "Private page".</summary>
    public async Task<IReadOnlyList<NotePageRefDto>> BreadcrumbAsync(NotePage page, Guid caller, CancellationToken cancellationToken)
    {
        var chain = new List<Guid>();
        var seen = new HashSet<Guid> { page.Id };
        var next = page.ParentId;
        while (next is { } id && seen.Add(id) && chain.Count < 50)
        {
            chain.Add(id);
            next = await db.NotePages.AsNoTracking().Where(p => p.Id == id).Select(p => p.ParentId).SingleOrDefaultAsync(cancellationToken);
        }

        var visible = await VisibleAsync(chain, caller, cancellationToken);
        chain.Reverse();
        return [.. chain.Select(id => visible.GetValueOrDefault(id) ?? Private)];
    }

    public async Task<IReadOnlyList<NotePageRefDto>> ChildrenAsync(Guid pageId, Guid caller, CancellationToken cancellationToken) =>
        await access.Visible(db.NotePages.AsNoTracking(), caller).Where(p => p.ParentId == pageId)
            .OrderByDescending(p => p.UpdatedAt).ThenBy(p => p.Id)
            .Select(p => new NotePageRefDto(p.Id, p.Title == "" ? Untitled : p.Title, p.Icon))
            .ToListAsync(cancellationToken);

    /// <summary>"Linked from": the linking pages the caller may open, most recently edited first (L2-090 AC5).</summary>
    public async Task<IReadOnlyList<NotePageRefDto>> BacklinksAsync(Guid pageId, Guid caller, CancellationToken cancellationToken)
    {
        var sources = db.NoteLinks.Where(l => l.TargetId == pageId).Select(l => l.SourceId);
        return await access.Visible(db.NotePages.AsNoTracking(), caller).Where(p => sources.Contains(p.Id))
            .OrderByDescending(p => p.UpdatedAt).ThenBy(p => p.Id)
            .Select(p => new NotePageRefDto(p.Id, p.Title == "" ? Untitled : p.Title, p.Icon))
            .ToListAsync(cancellationToken);
    }
}
