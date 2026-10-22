using System.Linq.Expressions;
using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Search;

/// <summary>The result groups, in the order the search page shows them (L2-026 AC1).</summary>
public enum SearchResultKind
{
    Person,
    Event,
    Partner,
    Contact,
    WorkItem,
    Resource,
    Note,
}

/// <summary>One result: what it is called, a line of context, and the app route that opens it.</summary>
public record SearchResultItem(Guid Id, string Title, string Snippet, string Route, DateTimeOffset? StartsAt = null, string? Badge = null);

public record SearchResultGroup(string Kind, IReadOnlyList<SearchResultItem> Items);

public record SearchResultsDto(IReadOnlyList<SearchResultGroup> Groups);

/// <summary>
/// Filters and ranks a query by a search term (ADR 0016). PostgreSQL matches each table's generated, GIN-indexed
/// <c>tsvector</c>; the in-memory implementation used by the backend tests matches <paramref name="document"/>.
/// </summary>
public interface IFullTextSearch
{
    /// <param name="document">The record's searchable text: the same fields its <c>tsvector</c> is built from.</param>
    IQueryable<T> Match<T>(IQueryable<T> source, string term, Expression<Func<T, string>> document) where T : class;
}

/// <summary>
/// One searchable kind. A source starts from a query already filtered to what the caller may open, so the
/// permission filter and the text match run in one database query (L2-026 AC2). Later features plug in here.
/// </summary>
public interface ISearchSource
{
    SearchResultKind Kind { get; }

    Task<IReadOnlyList<SearchResultItem>> SearchAsync(string term, Guid caller, int limit, CancellationToken cancellationToken = default);
}

/// <summary>Global search (L2-026): every source the caller may use, grouped, at most 10 results a group.</summary>
public class GlobalSearchHandler(IApplicationDbContext db, ICurrentUser current, IEnumerable<ISearchSource> sources)
{
    public const int MinimumLength = 2;
    public const int MaximumLength = 200;
    public const int GroupLimit = 10;
    public const string ShortMessage = "Type at least 2 characters to search.";

    public async Task<(Result Result, SearchResultsDto? Results)> SearchAsync(string? q, CancellationToken cancellationToken = default)
    {
        var term = q?.Trim() ?? string.Empty;
        if (term.Length < MinimumLength)
        {
            return (Result.Invalid("q", ShortMessage), null);
        }

        if (term.Length > MaximumLength)
        {
            return (Result.Invalid("q", $"Use {MaximumLength} characters or fewer."), null);
        }

        var caller = current.UserId is { } userId
            ? await db.Users.Where(u => u.Id == userId).Select(u => u.ProfileId).SingleOrDefaultAsync(cancellationToken)
            : Guid.Empty;
        var groups = new List<SearchResultGroup>();
        // One source at a time: they share the request's DbContext.
        foreach (var source in sources.OrderBy(s => s.Kind))
        {
            var items = await source.SearchAsync(term, caller, GroupLimit, cancellationToken);
            if (items.Count > 0)
            {
                groups.Add(new SearchResultGroup(source.Kind.ToString(), items));
            }
        }

        return (Result.Ok(), new SearchResultsDto(groups));
    }
}

internal static class Snippets
{
    /// <summary>"Volunteer · Toronto · Led the intake team", leaving out empty parts.</summary>
    public static string Join(params string?[] parts) =>
        string.Join(" · ", parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));

    public static string? Short(string? text, int max = 120) =>
        text is null || text.Length <= max ? text : text[..(max - 1)].TrimEnd() + "…";
}
