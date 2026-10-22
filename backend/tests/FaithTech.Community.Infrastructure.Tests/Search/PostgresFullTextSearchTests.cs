// Traces to: L2-026
using FaithTech.Community.Infrastructure.Persistence;
using FaithTech.Community.Infrastructure.Search;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Infrastructure.Tests.Search;

/// <summary>
/// What PostgresFullTextSearch asks PostgreSQL to run. The SQL is generated without a connection, so these run
/// without a database; the search behaviour itself is covered through the API with the in-memory implementation.
/// </summary>
public class PostgresFullTextSearchTests
{
    private readonly PostgresFullTextSearch _search = new();

    [Theory]
    [InlineData("shelter", "shelter:*")]
    [InlineData("  Gra   she ", "gra:* & she:*")]
    [InlineData("a&b:* | !c", "a:* & b:* & c:*")]
    [InlineData("Tomás O'Neil", "tomás:* & o:* & neil:*")]
    public void A_term_becomes_a_prefix_query_of_its_words_and_nothing_else(string term, string query)
    {
        Assert.Equal(query, PostgresFullTextSearch.PrefixQuery(term));
    }

    [Theory]
    [InlineData("")]
    [InlineData("&|!:*")]
    public void A_term_without_words_matches_nothing(string term)
    {
        Assert.Null(PostgresFullTextSearch.PrefixQuery(term));
    }

    [Fact]
    public void The_permission_filter_and_the_ranked_text_match_run_in_one_statement()
    {
        using var db = new DesignTimeDbContextFactory().CreateDbContext([]);
        var owner = Guid.NewGuid();

        var sql = _search.Match(db.Contacts.Where(c => c.OwnerId == owner && c.ArchivedAtUtc == null), "harbour light", c => c.Name)
            .Take(10)
            .ToQueryString();

        Assert.Contains("\"OwnerId\" = ", sql);
        Assert.Contains("\"SearchVector\" @@ to_tsquery('english',", sql);
        Assert.Contains("ts_rank(", sql);
        Assert.Contains("harbour:* & light:*", sql);
    }
}
