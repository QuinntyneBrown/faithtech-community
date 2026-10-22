using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Search;

/// <summary>The result groups, in the order the page shows them.</summary>
public enum SearchResultKind
{
    Person,
    Event,
    Partner,
    Contact,
    WorkItem,
}

/// <summary>
/// Matches records against a search term. Postgres full-text search in production; the scope filters are applied by
/// each <see cref="ISearchSource"/> before the match, so they never depend on the matcher (ADR 0017).
/// </summary>
public interface IFullTextSearch
{
    /// <summary>Records of <typeparamref name="T"/> whose text matches every word of the term as a prefix, best first.</summary>
    IQueryable<T> Match<T>(IQueryable<T> source, string term) where T : class;
}

/// <summary>What the caller may find, derived from their roles (L2-026 AC2).</summary>
public record SearchScope(Guid? CallerProfileId, bool Partners, bool AllWorkspaces)
{
    public static SearchScope For(ICurrentUser current, Guid? callerProfileId) => new(
        callerProfileId,
        Partners: current.HoldsLeadRole() || current.HasRole(Role.Staff) || current.HasRole(Role.SystemAdmin),
        AllWorkspaces: current.HasRole(Role.Staff) || current.HasRole(Role.SystemAdmin));
}

public record SearchHit(Guid Id, string Title, string Snippet, string Route);

/// <summary>One searchable kind. A feature makes its records searchable by registering one (ADR 0017).</summary>
public interface ISearchSource
{
    SearchResultKind Kind { get; }

    /// <summary>Only records the scope lets the caller open; an empty list when it lets them open none.</summary>
    Task<IReadOnlyList<SearchHit>> SearchAsync(string term, SearchScope scope, int limit, CancellationToken cancellationToken = default);
}

public record SearchItemDto(Guid Id, string Title, string Snippet, string Route);

public record SearchGroupDto(string Kind, IReadOnlyList<SearchItemDto> Items);

public record SearchResultsDto(IReadOnlyList<SearchGroupDto> Groups);

/// <summary>Global search (L2-026): every registered source the caller may see, non-empty groups only.</summary>
public class GlobalSearchHandler(IEnumerable<ISearchSource> sources, ICurrentUser current, ProfileAccess access)
{
    public const int MinimumLength = 2;
    public const int PerGroup = 10;

    public async Task<(Result Result, SearchResultsDto? Results)> HandleAsync(string? q, CancellationToken cancellationToken = default)
    {
        var term = q?.Trim() ?? string.Empty;
        if (term.Length < MinimumLength)
        {
            return (Result.Invalid("q", $"Type at least {MinimumLength} characters to search."), null);
        }

        var scope = SearchScope.For(current, await access.CallerProfileIdAsync(cancellationToken));
        var groups = new List<SearchGroupDto>();
        foreach (var source in sources.OrderBy(s => s.Kind))
        {
            var hits = await source.SearchAsync(term, scope, PerGroup, cancellationToken);
            if (hits.Count > 0)
            {
                groups.Add(new SearchGroupDto(source.Kind.ToString(), [.. hits.Select(h => new SearchItemDto(h.Id, h.Title, h.Snippet, h.Route))]));
            }
        }

        return (Result.Ok(), new SearchResultsDto(groups));
    }

    internal static string Snippet(params string?[] parts) =>
        string.Join(" · ", parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim().Length > 120 ? p.Trim()[..117] + "…" : p.Trim()));
}
