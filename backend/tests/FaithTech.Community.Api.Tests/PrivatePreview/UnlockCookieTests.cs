using System.Net;
using Microsoft.AspNetCore.Hosting;

namespace FaithTech.Community.Api.Tests.PrivatePreview;

// Traces to: L2-086 AC3, L2-089, L2-090.
public class UnlockCookieTests(PrivatePreviewApiFactory factory) : IClassFixture<PrivatePreviewApiFactory>
{
    /// <summary>"another passphrase for the owner", hashed by wall-hash.</summary>
    private const string RotatedHash = "pbkdf2-sha256$600000$cLDJvP9H/WDJ/Bw9/R2eXA==$TEUHHv8RgwHEFqgjlSaBd/vg5db/DXAuXGrq9C1BLls=";

    [Fact]
    public async Task The_unlock_cookie_is_http_only_secure_lax_for_the_parent_domain_and_lasts_7_days()
    {
        var response = await factory.SubmitAsync(await factory.OpenWallAsync(), PrivatePreviewApiFactory.Passphrase);

        var cookie = Attributes(PrivatePreviewApiFactory.UnlockCookie(response)!);
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=lax", cookie);
        Assert.Contains("path=/", cookie);
        Assert.Contains("max-age=604800", cookie);
        Assert.Contains("domain=faithtech.test", cookie);
    }

    [Fact]
    public async Task Without_a_cookie_domain_the_unlock_is_host_only()
    {
        await using var app = factory.WithWebHostBuilder(b => b.UseSetting("PrivatePreview:CookieDomain", ""));
        var client = Browser(app);
        var response = await BruteForceTests.AttemptAsync(client, PrivatePreviewApiFactory.Passphrase);

        Assert.DoesNotContain(Attributes(PrivatePreviewApiFactory.UnlockCookie(response)!), a => a.StartsWith("domain=", StringComparison.Ordinal));
    }

    [Fact]
    public async Task The_csrf_cookie_is_host_only_strict_and_secure()
    {
        var response = await factory.Browser().SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));

        var cookie = Attributes(response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("__Host-wall=", StringComparison.Ordinal)));
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=strict", cookie);
        Assert.Contains("path=/", cookie);
        Assert.DoesNotContain(cookie, a => a.StartsWith("domain=", StringComparison.Ordinal));
    }

    [Fact]
    public async Task An_unlock_is_refused_once_its_7_days_are_up_whatever_the_browser_kept()
    {
        var cookie = await factory.UnlockAsync();
        Assert.Equal(HttpStatusCode.OK, (await Ready(factory.Browser(), cookie)).StatusCode);

        factory.Time.Advance(TimeSpan.FromDays(7) + TimeSpan.FromSeconds(1));

        Assert.Equal(HttpStatusCode.Forbidden, (await Ready(factory.Browser(), cookie)).StatusCode);
    }

    public static TheoryData<string> Forgeries() => new()
    {
        "",
        "w1",
        "w1.4102444800",
        "w1.4102444800.",
        "w1.4102444800.not-a-mac",
        "w2.4102444800.AAAA",
        "{\"unlocked\":true}",
    };

    [Theory]
    [MemberData(nameof(Forgeries))]
    public async Task A_forged_or_malformed_unlock_is_refused(string value)
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await Ready(factory.Browser(), $"__Secure-unlock={value}")).StatusCode);
    }

    [Fact]
    public async Task An_unlock_with_any_byte_changed_is_refused()
    {
        var cookie = await factory.UnlockAsync();
        var parts = cookie.Split('.');
        var mac = parts[2].ToCharArray();
        mac[0] = mac[0] == 'A' ? 'B' : 'A';
        var expiry = long.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture) + 86_400;

        Assert.Equal(HttpStatusCode.Forbidden, (await Ready(factory.Browser(), $"{parts[0]}.{parts[1]}.{new string(mac)}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Ready(factory.Browser(), $"{parts[0]}.{expiry}.{parts[2]}")).StatusCode);
    }

    [Fact]
    public async Task Rotating_the_signing_key_revokes_every_unlock()
    {
        var cookie = await factory.UnlockAsync();
        await using var rotated = factory.WithWebHostBuilder(b => b.UseSetting("PrivatePreview:SigningKey", "o6m0Y7Xv4yq2d8t1bWmJmF0qkVd5vJ3cR9Hn2sZr6Lw="));

        Assert.Equal(HttpStatusCode.Forbidden, (await Ready(Browser(rotated), cookie)).StatusCode);
    }

    [Fact]
    public async Task Rotating_the_passphrase_refuses_the_old_one_and_keeps_existing_unlocks()
    {
        var cookie = await factory.UnlockAsync();
        await using var rotated = factory.WithWebHostBuilder(b => b.UseSetting("PrivatePreview:PassphraseHash", RotatedHash));

        Assert.Equal(HttpStatusCode.Forbidden, (await BruteForceTests.AttemptAsync(Browser(rotated), PrivatePreviewApiFactory.Passphrase)).StatusCode);
        Assert.Equal(HttpStatusCode.SeeOther, (await BruteForceTests.AttemptAsync(Browser(rotated), "another passphrase for the owner")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Ready(Browser(rotated), cookie)).StatusCode);
    }

    [Theory]
    [InlineData(CommunityApiFactory.MarketingOrigin)]
    [InlineData(CommunityApiFactory.WebAppOrigin)]
    public async Task A_cors_preflight_from_our_own_origins_is_answered_while_locked(string origin)
    {
        var response = await factory.Browser().SendAsync(Preflight(origin));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(origin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task A_cors_preflight_from_another_origin_is_refused_while_locked()
    {
        var response = await factory.Browser().SendAsync(Preflight("https://evil.example"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    private static HttpRequestMessage Preflight(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/account/sign-in");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        return request;
    }

    private static Task<HttpResponseMessage> Ready(HttpClient client, string cookie)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health/ready");
        request.Headers.Add("Cookie", cookie);
        return client.SendAsync(request);
    }

    private static string[] Attributes(string setCookie) =>
        setCookie.Split(';').Select(a => a.Trim().ToLowerInvariant()).ToArray();

    private static HttpClient Browser(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> app)
    {
        var client = app.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
        client.BaseAddress = new Uri(CommunityApiFactory.WebAppOrigin);
        client.DefaultRequestHeaders.Add(PrivatePreviewApiFactory.ClientHeader, PrivatePreviewApiFactory.NewClientAddress());
        return client;
    }
}
