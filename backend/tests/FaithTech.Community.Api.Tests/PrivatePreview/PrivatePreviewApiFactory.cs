using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FaithTech.Community.Api.Tests.PrivatePreview;

/// <summary>The API with the private-preview wall on, as production runs it (ADR 0023).</summary>
public class PrivatePreviewApiFactory : CommunityApiFactory
{
    /// <summary>The owner's passphrase in these tests; production keeps only its hash, in Key Vault.</summary>
    public const string Passphrase = "correct horse battery staple";

    /// <summary>PBKDF2-SHA256, 600,000 iterations, of <see cref="Passphrase"/>.</summary>
    public const string PassphraseHash =
        "pbkdf2-sha256$600000$RaxG9muI8mKQQTL+tT3uzQ==$91P6wDOYJ0a1uSb2juA8e/vvCqKlXhBxARylrXUHCXI=";

    public const string SigningKey = "4VnJ8Jyyb8WH+c/TIgv0bR5Fsi2eK4yJkiKTd/Vmxt0=";

    public const string CookieDomain = "faithtech.test";

    /// <summary>Test-only header that stands in for the client's network address, so tests can act as several visitors.</summary>
    public const string ClientHeader = "X-Test-Client";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("PrivatePreview:Enabled", "true");
        builder.UseSetting("PrivatePreview:PassphraseHash", PassphraseHash);
        builder.UseSetting("PrivatePreview:SigningKey", SigningKey);
        builder.UseSetting("PrivatePreview:CookieDomain", CookieDomain);
        builder.ConfigureServices(services => services.AddSingleton<IStartupFilter, ClientAddressFilter>());
    }

    /// <summary>
    /// Opens the wall page on <paramref name="origin"/> as a browser would and returns the form's CSRF value and the
    /// <c>__Host-wall</c> cookie that must travel with it.
    /// </summary>
    public async Task<WallForm> OpenWallAsync(string origin = WebAppOrigin, string path = "/")
    {
        var response = await Browser(origin).SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, path));
        var html = await response.Content.ReadAsStringAsync();
        var csrf = System.Text.RegularExpressions.Regex.Match(html, "name=\"csrf\" value=\"([^\"]+)\"").Groups[1].Value;
        var cookie = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("__Host-wall=", StringComparison.Ordinal));
        return new WallForm(csrf, cookie[..cookie.IndexOf(';')]);
    }

    /// <summary>Posts the wall form as the browser would after <see cref="OpenWallAsync"/>.</summary>
    public Task<HttpResponseMessage> SubmitAsync(
        WallForm form,
        string? passphrase,
        string returnUrl = "/",
        string origin = WebAppOrigin,
        string? csrf = null,
        string? originHeader = null,
        HttpClient? client = null)
    {
        var fields = new List<KeyValuePair<string, string>> { new("csrf", csrf ?? form.Csrf), new("returnUrl", returnUrl) };
        if (passphrase is not null)
        {
            fields.Add(new("passphrase", passphrase));
        }

        var request = new HttpRequestMessage(HttpMethod.Post, "/__wall/unlock") { Content = new FormUrlEncodedContent(fields) };
        request.Headers.Add("Cookie", form.Cookie);
        request.Headers.Add("Origin", originHeader ?? origin);
        request.Headers.Accept.ParseAdd("text/html");
        return (client ?? Browser(origin)).SendAsync(request);
    }

    /// <summary>Unlocks and returns the <c>__Secure-unlock</c> cookie as a request <c>Cookie</c> value.</summary>
    public async Task<string> UnlockAsync(string origin = WebAppOrigin)
    {
        var response = await SubmitAsync(await OpenWallAsync(origin), Passphrase, origin: origin);
        var cookie = UnlockCookie(response) ?? throw new InvalidOperationException($"Unlock failed with {response.StatusCode}.");
        return cookie[..cookie.IndexOf(';')];
    }

    public static string? UnlockCookie(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Set-Cookie", out var cookies)
            ? cookies.SingleOrDefault(c => c.StartsWith("__Secure-unlock=", StringComparison.Ordinal))
            : null;

    /// <summary>A browser-like client on <paramref name="origin"/> that keeps redirects and cookies for the test to inspect.</summary>
    public HttpClient Browser(string origin = WebAppOrigin)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
        client.BaseAddress = new Uri(origin);
        client.DefaultRequestHeaders.Add(ClientHeader, NewClientAddress());
        return client;
    }

    /// <summary>A fresh address, so one test's refusals never lock another test out.</summary>
    public static string NewClientAddress() => $"10.{Random.Shared.Next(256)}.{Random.Shared.Next(256)}.{Random.Shared.Next(1, 255)}";

    private sealed class ClientAddressFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                if (IPAddress.TryParse(context.Request.Headers[ClientHeader], out var address))
                {
                    context.Connection.RemoteIpAddress = address;
                }

                return nextMiddleware(context);
            });
            next(app);
        };
    }
}

public record WallForm(string Csrf, string Cookie);
