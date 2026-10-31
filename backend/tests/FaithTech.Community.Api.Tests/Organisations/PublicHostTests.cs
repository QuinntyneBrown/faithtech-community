using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.PrivatePreview;
using Microsoft.AspNetCore.Hosting;

namespace FaithTech.Community.Api.Tests.Organisations;

/// <summary>
/// The API with both Angular builds and a second organisation's public host in <c>Marketing:Sites</c>, with the wall
/// lifted so each request reaches host resolution directly.
/// </summary>
public sealed class PublicHostsApiFactory : CommunityApiFactory
{
    public const string NorthsidePublicOrigin = "https://www.northside.test";
    public const string NorthsideCommunityOrigin = "https://app.northside.test";

    public string Root { get; } = Directory.CreateTempSubdirectory("public-hosts-").FullName;

    public PublicHostsApiFactory()
    {
        Write("app/index.html", "<!doctype html><title>community app</title>");
        Write("www/index.html", "<!doctype html><title>marketing page</title>");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("StaticSites:AppRoot", Path.Combine(Root, "app"));
        builder.UseSetting("StaticSites:MarketingRoot", Path.Combine(Root, "www"));
        const string site = "Marketing:Sites:www.northside.test:";
        builder.UseSetting(site + "OrganisationSlug", "northside");
        builder.UseSetting(site + "Headline", "Make things with your neighbours");
        builder.UseSetting(site + "Footer", "© 2026 Northside Makers");
        builder.UseSetting(site + "BrochureUrl", "/brochure/northside.webm");
        builder.UseSetting(site + "BrochurePosterUrl", "/brochure/northside-poster.jpg");
        builder.UseSetting(site + "BrochureCaptionsUrl", "/brochure/northside.en.vtt");
        builder.UseSetting(site + "BrochureTitle", "Northside Makers in 30 seconds");
        builder.UseSetting(site + "BrochurePosterAlt", "Makers at a workbench");
        // A public host whose organisation does not exist is unknown, like any other unmatched host.
        builder.UseSetting("Marketing:Sites:www.nobody.test:OrganisationSlug", "nobody");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (Directory.Exists(Root))
        {
            Directory.Delete(Root, recursive: true);
        }
    }

    private void Write(string path, string content)
    {
        var file = Path.Combine(Root, path);
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, content);
    }
}

// Traces to: L2-134 AC3, L2-131 AC6. One marketing build serves every organisation's public host, with the headline,
// brochure and footer of that host's Marketing:Sites entry; a public host with no entry is unknown. CORS admits only
// the current organisation's community and public origins.
public class PublicHostTests(PublicHostsApiFactory factory) : IClassFixture<PublicHostsApiFactory>
{
    public sealed record Brochure(string Url, string PosterUrl, string CaptionsUrl, string Title, string PosterAlt);

    public sealed record PublicSite(string Name, string ShortName, string CommunityOrigin, string? Headline, Brochure? Brochure, string? Footer);

    [Theory]
    [InlineData(PublicHostsApiFactory.NorthsideCommunityOrigin, "community app")]
    [InlineData(PublicHostsApiFactory.NorthsidePublicOrigin, "marketing page")]
    [InlineData(CommunityApiFactory.WebAppOrigin, "community app")]
    [InlineData(CommunityApiFactory.MarketingOrigin, "marketing page")]
    public async Task Each_host_gets_the_build_for_its_kind(string origin, string title)
    {
        await factory.AddOrganisationAsync();

        var response = await Client(origin).SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains($"<title>{title}</title>", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_public_page_lets_the_browser_call_its_own_organisations_community_host()
    {
        await factory.AddOrganisationAsync();

        var response = await Client(PublicHostsApiFactory.NorthsidePublicOrigin).SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));

        var csp = string.Join(", ", response.Headers.GetValues("Content-Security-Policy"));
        Assert.Contains($"connect-src 'self' {PublicHostsApiFactory.NorthsideCommunityOrigin} wss://app.northside.test", csp);
        Assert.DoesNotContain("faithtech", csp);
    }

    [Theory]
    [InlineData("https://www.unlisted.test")]
    [InlineData("https://www.nobody.test")]
    public async Task A_public_host_with_no_organisation_gets_the_unknown_host_page(string origin)
    {
        var response = await Client(origin).SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain("marketing page", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task The_site_on_a_public_host_carries_its_entrys_headline_brochure_and_footer()
    {
        await factory.AddOrganisationAsync();

        var site = await Client(PublicHostsApiFactory.NorthsidePublicOrigin).GetFromJsonAsync<PublicSite>("/api/site");

        Assert.Equal(
            new PublicSite(
                "northside community",
                "northside",
                PublicHostsApiFactory.NorthsideCommunityOrigin,
                "Make things with your neighbours",
                new Brochure("/brochure/northside.webm", "/brochure/northside-poster.jpg", "/brochure/northside.en.vtt", "Northside Makers in 30 seconds", "Makers at a workbench"),
                "© 2026 Northside Makers"),
            site);
    }

    [Fact]
    public async Task FaithTechs_public_host_reads_its_default_entry_as_before()
    {
        var site = await Client(CommunityApiFactory.MarketingOrigin).GetFromJsonAsync<PublicSite>("/api/site");

        Assert.Equal("Build with people who share your faith", site!.Headline);
        Assert.Equal("© 2026 FaithTech", site.Footer);
        Assert.Equal(
            new Brochure("/brochure/brochure.webm", "/brochure/brochure-poster.jpg", "/brochure/brochure.en.vtt", "FaithTech Community in 21 seconds", "FaithTech builders pairing at a hackathon table"),
            site.Brochure);
    }

    [Fact]
    public async Task The_site_on_a_community_host_has_no_marketing_content()
    {
        await factory.AddOrganisationAsync();

        var site = await Client(PublicHostsApiFactory.NorthsideCommunityOrigin).GetFromJsonAsync<PublicSite>("/api/site");

        Assert.Equal((null, null, null), (site!.Headline, site.Brochure, site.Footer));
    }

    [Theory]
    [InlineData(PublicHostsApiFactory.NorthsideCommunityOrigin, PublicHostsApiFactory.NorthsidePublicOrigin, true)]
    [InlineData(PublicHostsApiFactory.NorthsideCommunityOrigin, PublicHostsApiFactory.NorthsideCommunityOrigin, true)]
    [InlineData(PublicHostsApiFactory.NorthsideCommunityOrigin, CommunityApiFactory.MarketingOrigin, false)]
    [InlineData(PublicHostsApiFactory.NorthsideCommunityOrigin, CommunityApiFactory.WebAppOrigin, false)]
    [InlineData(PublicHostsApiFactory.NorthsideCommunityOrigin, "https://evil.test", false)]
    [InlineData(CommunityApiFactory.WebAppOrigin, CommunityApiFactory.MarketingOrigin, true)]
    [InlineData(CommunityApiFactory.WebAppOrigin, PublicHostsApiFactory.NorthsidePublicOrigin, false)]
    public async Task Cors_admits_only_the_current_organisations_origins(string host, string origin, bool allowed)
    {
        await factory.AddOrganisationAsync();
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/account/sign-in");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");

        var response = await Client(host).SendAsync(request);

        if (allowed)
        {
            Assert.Equal(origin, Header(response, "Access-Control-Allow-Origin"));
            Assert.Equal("true", Header(response, "Access-Control-Allow-Credentials"));
        }
        else
        {
            Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        }
    }

    private HttpClient Client(string origin)
    {
        var client = factory.CreateClient();
        client.BaseAddress = new Uri(origin);
        return client;
    }

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? string.Join(",", values) : string.Empty;
}
