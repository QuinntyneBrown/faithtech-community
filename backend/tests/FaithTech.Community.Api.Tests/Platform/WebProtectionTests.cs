using System.Net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Platform;

public class WebProtectionTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task Every_response_carries_the_security_headers()
    {
        var response = await factory.CreateClient().GetAsync("/health/live");

        Assert.StartsWith("max-age=", Header(response, "Strict-Transport-Security"));
        var csp = Header(response, "Content-Security-Policy");
        Assert.Contains("frame-ancestors 'none'", csp);
        Assert.DoesNotContain("unsafe-inline", csp);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
    }

    [Fact]
    public async Task Error_responses_also_carry_the_security_headers()
    {
        var response = await factory.CreateClient().GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
    }

    [Fact]
    public async Task Preflight_from_the_web_app_origin_is_allowed()
    {
        var response = await factory.CreateClient().SendAsync(Preflight(CommunityApiFactory.WebAppOrigin));

        Assert.Equal(CommunityApiFactory.WebAppOrigin, Header(response, "Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Preflight_from_another_origin_is_rejected()
    {
        var response = await factory.CreateClient().SendAsync(Preflight("https://evil.example"));

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task More_than_100_requests_a_minute_from_one_user_return_429()
    {
        var client = AuthenticatedClient();
        var heavyUser = Guid.NewGuid().ToString();

        for (var i = 0; i < 100; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(MeRequest(heavyUser))).StatusCode);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.SendAsync(MeRequest(heavyUser))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(MeRequest(Guid.NewGuid().ToString()))).StatusCode);
    }

    private HttpClient AuthenticatedClient() => factory.WithWebHostBuilder(b => b.ConfigureServices(s => s
        .AddAuthentication(TestAuthHandler.SchemeName)
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null))).CreateClient();

    private static HttpRequestMessage MeRequest(string userId)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        request.Headers.Add(TestAuthHandler.Header, userId);
        return request;
    }

    private static HttpRequestMessage Preflight(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/me");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        return request;
    }

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? string.Join(",", values) : string.Empty;
}
