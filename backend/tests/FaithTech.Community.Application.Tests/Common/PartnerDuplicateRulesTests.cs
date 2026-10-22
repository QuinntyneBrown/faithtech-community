// Traces to: L2-113 (docs/detailed-designs/partners/duplicate-detection-and-merge, ADR 0027)
//
// Given two partners, when their website hosts are equal after normalising (lowercase; no scheme,
// leading www., port, path, query or trailing dot), then they match by website (AC1). When their
// names are equal after folding accents, lowercasing, deleting punctuation, collapsing whitespace
// and removing one trailing company suffix, then they match by name (AC2). When they share only
// the contact email's domain, then they do not match (AC3).
using FaithTech.Community.Application.Partners;

namespace FaithTech.Community.Application.Tests.Common;

public class PartnerDuplicateRulesTests
{
    [Theory]
    [InlineData("https://www.Kestrel.example:8443/about?x=1", "kestrel.example")]
    [InlineData("kestrel.example.", "kestrel.example")]
    [InlineData("www.www.example", "www.example")]
    [InlineData("  http://KESTREL.example/#team ", "kestrel.example")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    [InlineData("not a url", null)]
    public void A_website_normalises_to_its_host(string? website, string? expected)
    {
        Assert.Equal(expected, PartnerDuplicateRules.NormaliseHost(website));
    }

    [Theory]
    [InlineData("Acme Ltd.", "acme")]
    [InlineData("acme", "acme")]
    [InlineData("Café Lumière Inc", "cafe lumiere")]
    [InlineData("  Harbour   Coffee  Co. ", "harbour coffee")]
    [InlineData("Kestrel Labs Inc.", "kestrel labs")]
    [InlineData("Company", "company")]
    [InlineData("Ltd Inc", "ltd")]
    [InlineData("Acme-Labs", "acmelabs")]
    [InlineData("!!!", null)]
    [InlineData(null, null)]
    public void A_name_normalises_to_its_key(string? name, string? expected)
    {
        Assert.Equal(expected, PartnerDuplicateRules.NormaliseName(name));
    }

    [Fact]
    public void Equal_hosts_match_by_website_before_names()
    {
        var a = PartnerKey.From(Guid.NewGuid(), "Kestrel Labs", "https://kestrel.example");
        var b = PartnerKey.From(Guid.NewGuid(), "Kestrel Labs Inc.", "www.kestrel.example/about");

        Assert.Equal(DuplicateReason.Website, PartnerDuplicateRules.Match(a, b));
    }

    [Fact]
    public void Equal_names_match_by_name_when_the_hosts_differ_or_are_missing()
    {
        var a = PartnerKey.From(Guid.NewGuid(), "Acme Ltd.", "acme.example");
        var b = PartnerKey.From(Guid.NewGuid(), "acme", null);
        var c = PartnerKey.From(Guid.NewGuid(), "ACME", "acme.org");

        Assert.Equal(DuplicateReason.Name, PartnerDuplicateRules.Match(a, b));
        Assert.Equal(DuplicateReason.Name, PartnerDuplicateRules.Match(a, c));
    }

    [Fact]
    public void Partners_with_different_names_and_no_shared_host_do_not_match()
    {
        // Both contacts use gmail.com; email is never compared (AC3).
        var a = PartnerKey.From(Guid.NewGuid(), "Harbour Coffee", null);
        var b = PartnerKey.From(Guid.NewGuid(), "Northside Church", null);

        Assert.Null(PartnerDuplicateRules.Match(a, b));
    }

    [Fact]
    public void Missing_hosts_and_names_never_match_each_other()
    {
        var a = PartnerKey.From(Guid.NewGuid(), "!!!", "");
        var b = PartnerKey.From(Guid.NewGuid(), "???", null);

        Assert.Null(PartnerDuplicateRules.Match(a, b));
    }
}
