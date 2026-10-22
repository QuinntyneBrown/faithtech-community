using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;

namespace FaithTech.Community.Api.Tests.PrivatePreview;

// Traces to: L2-085 AC2, AC3, L2-091.
public class WallHeadersTests(PrivatePreviewApiFactory factory) : IClassFixture<PrivatePreviewApiFactory>
{
    public static TheoryData<string, string> Responses() => new()
    {
        { "GET", "/" },
        { "GET", "/api/me" },
        { "GET", "/robots.txt" },
        { "GET", "/health/live" },
        { "POST", "/__wall/unlock" },
    };

    [Theory]
    [MemberData(nameof(Responses))]
    public async Task Every_response_while_the_wall_is_on_carries_noindex_and_the_security_headers(string method, string path)
    {
        var request = method == "GET" ? LockedRequestTests.Navigation(HttpMethod.Get, path) : new HttpRequestMessage(HttpMethod.Post, path);

        var response = await factory.Browser().SendAsync(request);

        Assert.Equal("noindex, nofollow", Header(response, "X-Robots-Tag"));
        Assert.Equal("max-age=31536000; includeSubDomains", Header(response, "Strict-Transport-Security"));
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
        Assert.Equal("no-referrer", Header(response, "Referrer-Policy"));
        Assert.False(response.Headers.Contains("Server"));
        Assert.False(response.Headers.Contains("X-Powered-By"));
    }

    [Fact]
    public async Task Unlocked_responses_carry_noindex_too()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        request.Headers.Add("Cookie", await factory.UnlockAsync());

        var response = await factory.Browser().SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("noindex, nofollow", Header(response, "X-Robots-Tag"));
    }

    [Fact]
    public async Task The_wall_page_has_a_strict_nonce_policy_with_a_fresh_nonce_each_time()
    {
        var first = await factory.Browser().SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));
        var second = await factory.Browser().SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));

        var csp = Header(first, "Content-Security-Policy");
        var nonce = Regex.Match(csp, "'nonce-([^']+)'").Groups[1].Value;
        Assert.Equal(
            $"default-src 'none'; style-src 'nonce-{nonce}'; script-src 'nonce-{nonce}'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
            csp);
        var html = await first.Content.ReadAsStringAsync();
        Assert.Contains($"<style nonce=\"{nonce}\">", html);
        Assert.Contains($"<script nonce=\"{nonce}\">", html);
        Assert.NotEqual(csp, Header(second, "Content-Security-Policy"));
    }

    [Fact]
    public async Task The_wall_page_says_nothing_about_the_product()
    {
        var response = await factory.Browser().SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));
        var html = await response.Content.ReadAsStringAsync();
        var everything = html + string.Join("\n", response.Headers.Concat(response.Content.Headers).Select(h => $"{h.Key}: {string.Join(", ", h.Value)}"));

        Assert.Contains("<title>Private preview</title>", html);
        Assert.Contains("<meta name=\"robots\" content=\"noindex, nofollow\">", html);
        Assert.Single(Regex.Matches(html, "<h1[ >]"));
        Assert.Contains("This site is not open yet. Enter the passphrase to continue.", html);
        foreach (var hint in new[] { "faithtech", "community", "angular", "aspnet", "asp.net", "kestrel", "microsoft", "openiddict", "og:", "name=\"description\"", "<img", "favicon.ico", "http://", "https://" })
        {
            Assert.DoesNotContain(hint, everything, StringComparison.OrdinalIgnoreCase);
        }

        Assert.DoesNotMatch(new Regex(@"\bft-", RegexOptions.IgnoreCase), everything);
    }

    [Fact]
    public async Task With_the_wall_off_no_noindex_is_sent()
    {
        var response = await factory.WithWebHostBuilder(b => b.UseSetting("PrivatePreview:Enabled", "false")).CreateClient().GetAsync("/health/live");

        Assert.False(response.Headers.Contains("X-Robots-Tag"));
        Assert.False(response.Headers.Contains("Server"));
    }

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) || response.Content.Headers.TryGetValues(name, out values)
            ? string.Join(", ", values)
            : string.Empty;
}
