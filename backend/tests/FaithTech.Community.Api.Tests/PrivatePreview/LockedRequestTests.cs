using System.Net;
using System.Net.Http.Headers;

namespace FaithTech.Community.Api.Tests.PrivatePreview;

// Traces to: L2-085, L2-086, L2-092.
public class LockedRequestTests(PrivatePreviewApiFactory factory) : IClassFixture<PrivatePreviewApiFactory>
{
    [Theory]
    [InlineData("/")]
    [InlineData("/events/0b7d3c1e-0000-0000-0000-000000000001")]
    [InlineData("/public/events/0b7d3c1e-0000-0000-0000-000000000001")]
    [InlineData("/sign-in")]
    [InlineData("/api/me")]
    public async Task A_locked_navigation_gets_the_wall_page_with_403(string path)
    {
        var response = await factory.Browser().SendAsync(Navigation(HttpMethod.Get, path));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("<title>Private preview</title>", html);
        Assert.Contains("action=\"/__wall/unlock\"", html);
    }

    [Fact]
    public async Task A_locked_navigation_on_the_marketing_host_gets_the_wall_page_too()
    {
        var response = await factory.Browser(CommunityApiFactory.MarketingOrigin).SendAsync(Navigation(HttpMethod.Get, "/"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Contains("<title>Private preview</title>", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("GET", "/api/me")]
    [InlineData("GET", "/api/public/events/0b7d3c1e-0000-0000-0000-000000000001")]
    [InlineData("GET", "/api/public/events/0b7d3c1e-0000-0000-0000-000000000001/calendar.ics")]
    [InlineData("POST", "/api/account/sign-in")]
    [InlineData("GET", "/connect/authorize?client_id=web&response_type=code")]
    [InlineData("POST", "/connect/token")]
    [InlineData("GET", "/.well-known/openid-configuration")]
    [InlineData("POST", "/hubs/agile/negotiate?negotiateVersion=1")]
    [InlineData("GET", "/hubs/agile")]
    [InlineData("GET", "/main-3XQ2ZP4K.js")]
    [InlineData("GET", "/main-3XQ2ZP4K.js.map")]
    [InlineData("GET", "/favicon.ico")]
    [InlineData("GET", "/brochure/brochure-poster.jpg")]
    [InlineData("GET", "/health/ready")]
    [InlineData("DELETE", "/api/contacts/0b7d3c1e-0000-0000-0000-000000000001")]
    public async Task Anything_else_while_locked_is_refused_with_an_empty_403(string method, string path)
    {
        var response = await factory.Browser().SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task A_websocket_upgrade_to_the_hub_is_refused_while_locked()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/hubs/agile?id=abc");
        request.Headers.Connection.Add("Upgrade");
        request.Headers.Upgrade.Add(new ProductHeaderValue("websocket"));
        request.Headers.Add("Sec-WebSocket-Version", "13");
        request.Headers.Add("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==");

        var response = await factory.Browser().SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task The_liveness_probe_is_answered_while_locked()
    {
        var response = await factory.Browser().GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData(CommunityApiFactory.WebAppOrigin)]
    [InlineData(CommunityApiFactory.MarketingOrigin)]
    public async Task Robots_txt_disallows_everything_while_locked(string origin)
    {
        var response = await factory.Browser(origin).GetAsync("/robots.txt");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("User-agent: *\nDisallow: /\n", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task With_the_wall_off_nothing_is_refused_and_the_wall_routes_do_not_exist()
    {
        var client = factory.WithWebHostBuilder(b => b.UseSetting("PrivatePreview:Enabled", "false")).CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
        Assert.NotEqual(HttpStatusCode.OK, (await client.GetAsync("/robots.txt")).StatusCode);
        Assert.NotEqual(HttpStatusCode.SeeOther, (await client.PostAsync("/__wall/unlock", new FormUrlEncodedContent([]))).StatusCode);
        Assert.False((await client.GetAsync("/health/live")).Headers.Contains("X-Robots-Tag"));
    }

    internal static HttpRequestMessage Navigation(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        request.Headers.Add("Sec-Fetch-Mode", "navigate");
        return request;
    }
}
