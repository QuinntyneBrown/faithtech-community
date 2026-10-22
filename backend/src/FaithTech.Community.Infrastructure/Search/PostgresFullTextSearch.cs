using System.Text.RegularExpressions;
using FaithTech.Community.Application.Search;
using FaithTech.Community.Domain.Agile;
using FaithTech.Community.Domain.Contacts;
using FaithTech.Community.Domain.Partners;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using NpgsqlTypes;

namespace FaithTech.Community.Infrastructure.Search;

/// <summary>
/// Postgres full-text search over a stored, GIN-indexed <c>SearchVector</c> column on each searchable table, built with
/// the <c>simple</c> configuration so names are not stemmed (L2-026, ADR 0017).
/// </summary>
public class PostgresFullTextSearch : IFullTextSearch
{
    public IQueryable<T> Match<T>(IQueryable<T> source, string term) where T : class
    {
        var query = PrefixQuery.From(term);
        if (query is null)
        {
            return source.Where(_ => false);
        }

        return source
            .Where(x => EF.Property<NpgsqlTsVector>(x, SearchVectors.Column).Matches(EF.Functions.ToTsQuery("simple", query)))
            .OrderByDescending(x => EF.Property<NpgsqlTsVector>(x, SearchVectors.Column).Rank(EF.Functions.ToTsQuery("simple", query)));
    }
}

/// <summary>Turns "Grace tor" into the tsquery "grace:* &amp; tor:*": every word must match as a prefix.</summary>
public static partial class PrefixQuery
{
    public static string? From(string term)
    {
        var words = Words().Matches(term.ToLowerInvariant()).Select(m => m.Value).Distinct().ToList();
        return words.Count == 0 ? null : string.Join(" & ", words.Select(w => w + ":*"));
    }

    // Letters and digits only, so nothing in the term can reach tsquery syntax.
    [GeneratedRegex(@"[\p{L}\p{N}]+")]
    private static partial Regex Words();
}

/// <summary>The stored search document of each searchable table, kept by Postgres as a generated column.</summary>
public static class SearchVectors
{
    public const string Column = "SearchVector";

    public static void Configure(ModelBuilder builder)
    {
        Add<Profile>(builder, "Name", "HomeCity", "Bio");
        Add<Contact>(builder, "Name", "Email", "Organization", "City");
        Add<Partner>(builder, "Name", "Offering", "ContactName", "Notes");
        Add<WorkItem>(builder, "Title", "Description");
    }

    private static void Add<T>(ModelBuilder builder, params string[] columns) where T : class
    {
        var document = string.Join(" || ' ' || ", columns.Select(c => $"coalesce(\"{c}\", '')"));
        builder.Entity<T>(entity =>
        {
            entity.Property<NpgsqlTsVector>(Column).HasComputedColumnSql($"to_tsvector('simple', {document})", stored: true);
            entity.HasIndex(Column).HasMethod("GIN");
        });
    }
}
