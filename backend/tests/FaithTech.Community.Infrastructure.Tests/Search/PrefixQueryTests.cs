// Traces to: L2-026
using FaithTech.Community.Infrastructure.Search;

namespace FaithTech.Community.Infrastructure.Tests.Search;

public class PrefixQueryTests
{
    [Theory]
    [InlineData("shelter", "shelter:*")]
    [InlineData("  Grace   Tor ", "grace:* & tor:*")]
    [InlineData("Tomás O'Ortega", "tomás:* & o:* & ortega:*")]
    [InlineData("grace grace", "grace:*")]
    [InlineData("a & b | !c:*", "a:* & b:* & c:*")]
    public void Every_word_becomes_a_prefix_that_must_match(string term, string expected)
    {
        Assert.Equal(expected, PrefixQuery.From(term));
    }

    [Theory]
    [InlineData("")]
    [InlineData("&|!():*'")]
    public void A_term_without_words_makes_no_query(string term)
    {
        Assert.Null(PrefixQuery.From(term));
    }
}
