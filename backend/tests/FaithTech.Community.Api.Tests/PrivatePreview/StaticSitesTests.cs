using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FaithTech.Community.Api.Tests.PrivatePreview;

/// <summary>The production container serves both Angular builds by host, behind the wall (L2-093).</summary>
public sealed class StaticSitesApiFactory : PrivatePreviewApiFactory
{
    public string Root { get; } = Directory.CreateTempSubdirectory("sites-").FullName;

    public StaticSitesApiFactory()
    {
        Write("app/index.html", "<!doctype html><title>community app</title>");
        Write("app/main-3XQ2ZP4K.js", "console.log('community');");
        Write("app/favicon.ico", "ico");
        Write("www/index.html", "<!doctype html><title>marketing page</title>");
        Write("www/main-ABCD1234.js", "console.log('marketing');");
        Write("www/brochure/brochure.webm", "webm");
        Write("www/brochure/brochure.en.vtt", "WEBVTT");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("StaticSites:AppRoot", Path.Combine(Root, "app"));
        builder.UseSetting("StaticSites:MarketingRoot", Path.Combine(Root, "www"));
        builder.UseSetting("StaticSites:ImageOrigins", "https://photos.blob.core.windows.net");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Directory.Delete(Root, recursive: true);
    }

    private void Write(string path, string content)
    {
        var file = Path.Combine(Root, path);
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, content);
    }
}

// Traces to: L2-086 AC1, L2-091 AC4, L2-093.
public class StaticSitesTests(StaticSitesApiFactory factory) : IClassFixture<StaticSitesApiFactory>
{
    [Theory]
    [InlineData(CommunityApiFactory.WebAppOrigin, "/", "community app")]
    [InlineData(CommunityApiFactory.WebAppOrigin, "/events/42", "community app")]
    [InlineData(CommunityApiFactory.WebAppOrigin, "/public/events/42", "community app")]
    [InlineData(CommunityApiFactory.MarketingOrigin, "/", "marketing page")]
    [InlineData(CommunityApiFactory.MarketingOrigin, "/?join", "marketing page")]
    public async Task An_unlocked_navigation_gets_the_build_for_its_host(string origin, string path, string title)
    {
        var response = await Unlocked(origin, LockedRequestTests.Navigation(HttpMethod.Get, path));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains($"<title>{title}</title>", await response.Content.ReadAsStringAsync());
        Assert.True(response.Headers.CacheControl?.NoCache);
    }

    [Fact]
    public async Task The_app_html_gets_the_app_policy_instead_of_the_api_policy()
    {
        var response = await Unlocked(CommunityApiFactory.MarketingOrigin, LockedRequestTests.Navigation(HttpMethod.Get, "/"));

        var csp = string.Join(", ", response.Headers.GetValues("Content-Security-Policy"));
        Assert.Contains("default-src 'self'", csp);
        Assert.Contains("script-src 'self';", csp);
        Assert.Contains("img-src 'self' data: blob: https://photos.blob.core.windows.net", csp);
        Assert.Contains("media-src 'self' blob:", csp);
        Assert.Contains($"connect-src 'self' {CommunityApiFactory.WebAppOrigin} wss://app.faithtech.test", csp);
        Assert.Contains("frame-ancestors 'none'", csp);
        Assert.DoesNotContain("'unsafe-inline'; ", csp.Split("style-src")[0]);
    }

    [Theory]
    [InlineData(CommunityApiFactory.WebAppOrigin, "/main-3XQ2ZP4K.js", "console.log('community');")]
    [InlineData(CommunityApiFactory.MarketingOrigin, "/main-ABCD1234.js", "console.log('marketing');")]
    [InlineData(CommunityApiFactory.MarketingOrigin, "/brochure/brochure.en.vtt", "WEBVTT")]
    public async Task Unlocked_static_files_are_served_from_their_own_build_and_cached_privately(string origin, string path, string content)
    {
        var response = await Unlocked(origin, new HttpRequestMessage(HttpMethod.Get, path));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(content, await response.Content.ReadAsStringAsync());
        var cache = response.Headers.CacheControl!;
        Assert.True(cache.Private);
        Assert.False(cache.Public);
        Assert.Equal(TimeSpan.FromDays(365), cache.MaxAge);
        Assert.Contains(cache.Extensions, e => e.Name == "immutable");
    }

    [Fact]
    public async Task A_missing_file_that_is_not_a_navigation_is_not_found()
    {
        var response = await Unlocked(CommunityApiFactory.WebAppOrigin, new HttpRequestMessage(HttpMethod.Get, "/missing-ZZZ.js"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task One_host_never_serves_the_other_hosts_files()
    {
        var response = await Unlocked(CommunityApiFactory.WebAppOrigin, new HttpRequestMessage(HttpMethod.Get, "/main-ABCD1234.js"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/me")]
    [InlineData("/connect/authorize?client_id=web")]
    [InlineData("/.well-known/openid-configuration")]
    [InlineData("/hubs/agile/negotiate")]
    public async Task Api_paths_still_reach_the_api_on_the_app_host(string path)
    {
        var response = await Unlocked(CommunityApiFactory.WebAppOrigin, LockedRequestTests.Navigation(HttpMethod.Get, path));

        Assert.DoesNotContain("<title>community app</title>", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/main-3XQ2ZP4K.js")]
    [InlineData("/favicon.ico")]
    public async Task Nothing_from_the_builds_is_served_while_locked(string path)
    {
        var response = await factory.Browser().SendAsync(new HttpRequestMessage(HttpMethod.Get, path));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.DoesNotContain("community", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task With_the_wall_lifted_the_builds_are_served_to_everyone()
    {
        await using var lifted = factory.WithWebHostBuilder(b => b.UseSetting("PrivatePreview:Enabled", "false"));
        var client = lifted.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri(CommunityApiFactory.MarketingOrigin) });

        var response = await client.SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));

        Assert.Contains("<title>marketing page</title>", await response.Content.ReadAsStringAsync());
    }

    private async Task<HttpResponseMessage> Unlocked(string origin, HttpRequestMessage request)
    {
        request.Headers.Add("Cookie", await factory.UnlockAsync(origin));
        return await factory.Browser(origin).SendAsync(request);
    }
}
