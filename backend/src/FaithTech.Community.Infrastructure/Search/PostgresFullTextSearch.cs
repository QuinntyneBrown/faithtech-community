using System.Linq.Expressions;
using System.Text.RegularExpressions;
using FaithTech.Community.Application.Search;
using Microsoft.EntityFrameworkCore;
using NpgsqlTypes;

namespace FaithTech.Community.Infrastructure.Search;

/// <summary>
/// PostgreSQL full-text search (L2-026, ADR 0016). Each searchable table has a generated, GIN-indexed
/// <c>SearchVector</c> column (<see cref="SearchVectors"/>); a term becomes a prefix query, so "gra she" finds
/// "Grace" at a "Shelter", and results are ranked with <c>ts_rank</c>. The caller's permission filter is already
/// on <c>source</c>, so it runs in the same SQL statement.
/// </summary>
public partial class PostgresFullTextSearch : IFullTextSearch
{
    public const string Config = "english";

    public IQueryable<T> Match<T>(IQueryable<T> source, string term, Expression<Func<T, string>> document) where T : class
    {
        var query = PrefixQuery(term);
        if (query is null)
        {
            return source.Where(_ => false);
        }

        return source
            .Where(e => EF.Property<NpgsqlTsVector>(e, SearchVectors.Column).Matches(EF.Functions.ToTsQuery(Config, query)))
            .OrderByDescending(e => EF.Property<NpgsqlTsVector>(e, SearchVectors.Column).Rank(EF.Functions.ToTsQuery(Config, query)));
    }

    /// <summary>"Gra she!" becomes "gra:* &amp; she:*". Only letters and digits survive, so no tsquery syntax gets in.</summary>
    public static string? PrefixQuery(string term)
    {
        var words = Word().Matches(term).Select(m => m.Value.ToLowerInvariant()).ToList();
        return words.Count == 0 ? null : string.Join(" & ", words.Select(w => w + ":*"));
    }

    [GeneratedRegex(@"[\p{L}\p{N}]+")]
    private static partial Regex Word();
}
