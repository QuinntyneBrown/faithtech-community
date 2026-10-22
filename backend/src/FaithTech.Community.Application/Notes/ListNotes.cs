using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Search;
using FaithTech.Community.Domain.Notes;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Notes;

public record ListNotesQuery(string? Q, string? Owner, int Page = 1);

/// <summary>The Notes page (L2-085): what the caller may open, recently edited first, 25 a page, by owner and text.</summary>
public class ListNotesHandler(IApplicationDbContext db, NoteAccess access, NoteViews views, IFullTextSearch text)
{
    public const int PageSize = 25;

    public async Task<(Result Result, PagedResult<NotePageSummaryDto>? Page)> HandleAsync(ListNotesQuery query, CancellationToken cancellationToken = default)
    {
        var caller = await access.CallerAsync(cancellationToken);
        var pages = access.Visible(db.NotePages.AsNoTracking(), caller);
        switch (query.Owner)
        {
            case null or "" or "all":
                break;
            case "mine":
                pages = pages.Where(p => p.OwnerId == caller);
                break;
            case "shared":
                var roles = access.Roles;
                pages = pages.Where(p => p.OwnerId != caller && p.Visibility == NoteVisibility.Shared
                    && (p.SharedMembers.Any(m => m.ProfileId == caller) || p.SharedRoles.Any(x => roles.Contains(x.Role))));
                break;
            default:
                return (Result.Invalid("owner", "Choose all, mine or shared."), null);
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            pages = text.Match(pages, query.Q.Trim(), Document);
        }

        var request = new PageRequest(query.Page, PageSize);
        var total = await pages.CountAsync(cancellationToken);
        var page = pages.OrderByDescending(p => p.UpdatedAt).ThenBy(p => p.Id).Skip(request.Skip).Take(request.PageSize);
        var items = await views.SummariesAsync(page, caller, cancellationToken);
        return (Result.Ok(), new PagedResult<NotePageSummaryDto>(items, request.Page, request.PageSize, total));
    }

    /// <summary>The searchable text: the same fields the search vector is built from (ADR 0023).</summary>
    public static readonly System.Linq.Expressions.Expression<Func<NotePage, string>> Document =
        p => p.Title + " " + p.BodyText;
}
