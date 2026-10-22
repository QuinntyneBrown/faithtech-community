using System.Net;
using System.Text.RegularExpressions;
using FaithTech.Community.Application.PrivatePreview;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace FaithTech.Community.Api.Tests.PrivatePreview;

// Traces to: L2-086, L2-087.
public class UnlockTests(PrivatePreviewApiFactory factory) : IClassFixture<PrivatePreviewApiFactory>
{
    [Fact]
    public async Task The_correct_passphrase_redirects_to_the_page_first_asked_for_and_sets_the_unlock_cookie()
    {
        var form = await factory.OpenWallAsync(path: "/events/42?tab=rsvp");

        var response = await factory.SubmitAsync(form, PrivatePreviewApiFactory.Passphrase, returnUrl: "/events/42?tab=rsvp");

        Assert.Equal(HttpStatusCode.SeeOther, response.StatusCode);
        Assert.Equal("/events/42?tab=rsvp", response.Headers.Location?.OriginalString);
        Assert.NotNull(PrivatePreviewApiFactory.UnlockCookie(response));
    }

    [Fact]
    public async Task The_wall_form_carries_the_path_first_asked_for()
    {
        var response = await factory.Browser().SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/events/42?tab=rsvp"));

        Assert.Contains("name=\"returnUrl\" value=\"/events/42?tab=rsvp\"", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("https://evil.example/")]
    [InlineData("//evil.example/")]
    [InlineData("/\\evil.example/")]
    [InlineData("javascript:alert(1)")]
    [InlineData("events")]
    [InlineData("")]
    [InlineData("/a\r\nSet-Cookie: x=1")]
    public async Task A_return_url_that_is_not_a_local_path_goes_to_the_root(string returnUrl)
    {
        var response = await factory.SubmitAsync(await factory.OpenWallAsync(), PrivatePreviewApiFactory.Passphrase, returnUrl: returnUrl);

        Assert.Equal(HttpStatusCode.SeeOther, response.StatusCode);
        Assert.Equal("/", response.Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task A_return_url_over_2048_characters_goes_to_the_root()
    {
        var response = await factory.SubmitAsync(await factory.OpenWallAsync(), PrivatePreviewApiFactory.Passphrase, returnUrl: "/" + new string('a', 2048));

        Assert.Equal("/", response.Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task After_unlocking_requests_reach_the_api_with_its_own_rules()
    {
        var cookie = await factory.UnlockAsync();

        var me = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        me.Headers.Add("Cookie", cookie);
        var ready = new HttpRequestMessage(HttpMethod.Get, "/health/ready");
        ready.Headers.Add("Cookie", cookie);

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Browser().SendAsync(me)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await factory.Browser().SendAsync(ready)).StatusCode);
    }

    [Fact]
    public async Task An_unlock_on_app_also_opens_www()
    {
        var cookie = await factory.UnlockAsync(CommunityApiFactory.WebAppOrigin);

        var request = new HttpRequestMessage(HttpMethod.Get, "/health/ready");
        request.Headers.Add("Cookie", cookie);

        Assert.Equal(HttpStatusCode.OK, (await factory.Browser(CommunityApiFactory.MarketingOrigin).SendAsync(request)).StatusCode);
    }

    public static TheoryData<string, string?, bool, string?> Refusals() => new()
    {
        { "wrong passphrase", "correct horse battery stapler", true, null },
        { "empty passphrase", "", true, null },
        { "missing passphrase", null, true, null },
        { "passphrase over 1,024 characters", new string('x', 1025), true, null },
        { "missing CSRF value", PrivatePreviewApiFactory.Passphrase, false, null },
        { "mismatched CSRF value", PrivatePreviewApiFactory.Passphrase, true, "not-the-cookie-value" },
        { "Origin naming another host", PrivatePreviewApiFactory.Passphrase, true, "origin:https://evil.example" },
    };

    [Theory]
    [MemberData(nameof(Refusals))]
    public async Task Every_failure_gets_the_identical_refusal(string failure, string? passphrase, bool sendCsrf, string? tamper)
    {
        var reference = await factory.SubmitAsync(await factory.OpenWallAsync(), "an ordinary wrong passphrase");
        var form = await factory.OpenWallAsync();

        var response = await factory.SubmitAsync(
            form,
            passphrase,
            csrf: !sendCsrf ? string.Empty : tamper is { } t && !t.StartsWith("origin:", StringComparison.Ordinal) ? t : null,
            originHeader: tamper is { } o && o.StartsWith("origin:", StringComparison.Ordinal) ? o["origin:".Length..] : null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Null(PrivatePreviewApiFactory.UnlockCookie(response));
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("That passphrase didn’t work. Check it and try again.", body);
        Assert.Equal(Normalise(await reference.Content.ReadAsStringAsync()), Normalise(body));
        Assert.Equal((await reference.Content.ReadAsByteArrayAsync()).Length, (await response.Content.ReadAsByteArrayAsync()).Length);
        Assert.NotEqual(form.Csrf, Regex.Match(body, "name=\"csrf\" value=\"([^\"]+)\"").Groups[1].Value);
        _ = failure; // Names the case in the test output.
    }

    [Fact]
    public async Task The_passphrase_is_hashed_even_when_the_form_is_not_genuine()
    {
        var hasher = new CountingHasher();
        await using var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.Decorate(hasher)));
        var form = await OpenWallAsync(app);

        await Submit(app, form with { Csrf = "forged" }, PrivatePreviewApiFactory.Passphrase);

        Assert.Equal(1, hasher.Verifications);
    }

    [Fact]
    public async Task When_the_check_fails_the_wall_shows_a_generic_error_with_500()
    {
        await using var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.Replace(ServiceDescriptor.Singleton<IPassphraseHasher>(new ThrowingHasher()))));
        var form = await OpenWallAsync(app);

        var response = await Submit(app, form, PrivatePreviewApiFactory.Passphrase);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Something went wrong", body);
        Assert.Contains("Try again in a moment.", body);
        Assert.DoesNotContain("Exception", body);
        Assert.Null(PrivatePreviewApiFactory.UnlockCookie(response));
    }

    [Theory]
    [InlineData("PrivatePreview:PassphraseHash", "")]
    [InlineData("PrivatePreview:PassphraseHash", "not a hash")]
    [InlineData("PrivatePreview:PassphraseHash", "pbkdf2-sha256$1000$RaxG9muI8mKQQTL+tT3uzQ==$91P6wDOYJ0a1uSb2juA8e/vvCqKlXhBxARylrXUHCXI=")]
    [InlineData("PrivatePreview:SigningKey", "")]
    [InlineData("PrivatePreview:SigningKey", "dG9vIHNob3J0")]
    public void The_api_refuses_to_start_without_a_usable_hash_and_key(string key, string value)
    {
        using var app = factory.WithWebHostBuilder(b => b.UseSetting(key, value));

        Assert.ThrowsAny<Exception>(() => app.CreateClient());
    }

    private static string Normalise(string html) =>
        Regex.Replace(Regex.Replace(html, "nonce=\"[^\"]+\"", "nonce=\"\""), "name=\"csrf\" value=\"[^\"]+\"", "name=\"csrf\" value=\"\"");

    private static async Task<WallForm> OpenWallAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> app)
    {
        var client = Browser(app);
        var response = await client.SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));
        var html = await response.Content.ReadAsStringAsync();
        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("__Host-wall=", StringComparison.Ordinal));
        return new WallForm(Regex.Match(html, "name=\"csrf\" value=\"([^\"]+)\"").Groups[1].Value, cookie[..cookie.IndexOf(';')]);
    }

    private Task<HttpResponseMessage> Submit(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> app, WallForm form, string passphrase) =>
        factory.SubmitAsync(form, passphrase, client: Browser(app));

    private static HttpClient Browser(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> app)
    {
        var client = app.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
        client.BaseAddress = new Uri(CommunityApiFactory.WebAppOrigin);
        return client;
    }

    private sealed class ThrowingHasher : IPassphraseHasher
    {
        public string Hash(string passphrase) => throw new InvalidOperationException("Hashing is unavailable.");

        public bool Verify(string passphrase, string encodedHash) => throw new InvalidOperationException("Hashing is unavailable.");

        public bool IsUsable(string encodedHash) => true;
    }
}

/// <summary>Counts verifications while the real hasher does the work.</summary>
public class CountingHasher : IPassphraseHasher
{
    private int _verifications;

    public IPassphraseHasher Inner { get; set; } = null!;

    public int Verifications => _verifications;

    public string Hash(string passphrase) => Inner.Hash(passphrase);

    public bool Verify(string passphrase, string encodedHash)
    {
        Interlocked.Increment(ref _verifications);
        return Inner.Verify(passphrase, encodedHash);
    }

    public bool IsUsable(string encodedHash) => Inner.IsUsable(encodedHash);
}

internal static class HasherDecoration
{
    /// <summary>Wraps the registered <see cref="IPassphraseHasher"/> in <paramref name="spy"/>.</summary>
    public static void Decorate(this IServiceCollection services, CountingHasher spy)
    {
        var registered = services.Last(d => d.ServiceType == typeof(IPassphraseHasher));
        services.Replace(ServiceDescriptor.Singleton<IPassphraseHasher>(sp =>
        {
            spy.Inner = (IPassphraseHasher)(registered.ImplementationInstance
                ?? registered.ImplementationFactory?.Invoke(sp)
                ?? ActivatorUtilities.CreateInstance(sp, registered.ImplementationType!));
            return spy;
        }));
    }
}
