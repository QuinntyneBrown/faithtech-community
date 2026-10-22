using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

using FaithTech.Community.Api.Tests.Fakes;
using Serilog.Core;

namespace FaithTech.Community.Api.Tests.PrivatePreview;

// Traces to: L2-103.
public class BruteForceTests(PrivatePreviewApiFactory factory) : IClassFixture<PrivatePreviewApiFactory>
{
    internal const string Wrong = "synthetic-wrong-passphrase-for-logs";

    [Fact]
    public async Task Five_refusals_lock_an_address_out_even_for_the_correct_passphrase()
    {
        var attacker = factory.Browser();
        await FailAsync(attacker, 5);

        var response = await AttemptAsync(attacker, PrivatePreviewApiFactory.Passphrase);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Too many attempts", body);
        Assert.Contains("Wait a few minutes, then try again.", body);
        Assert.Null(PrivatePreviewApiFactory.UnlockCookie(response));
    }

    [Fact]
    public async Task Another_address_is_not_affected_by_one_locked_out()
    {
        await FailAsync(factory.Browser(), 5);

        var response = await AttemptAsync(factory.Browser(), PrivatePreviewApiFactory.Passphrase);

        Assert.Equal(HttpStatusCode.SeeOther, response.StatusCode);
    }

    [Fact]
    public async Task Four_refusals_do_not_lock_out()
    {
        var owner = factory.Browser();
        await FailAsync(owner, 4);

        Assert.Equal(HttpStatusCode.SeeOther, (await AttemptAsync(owner, PrivatePreviewApiFactory.Passphrase)).StatusCode);
    }

    [Fact]
    public async Task Each_repeat_lockout_lasts_twice_as_long()
    {
        var attacker = factory.Browser();
        await FailAsync(attacker, 5);

        factory.Time.Advance(TimeSpan.FromSeconds(61));
        await FailAsync(attacker, 5);
        factory.Time.Advance(TimeSpan.FromSeconds(61));
        Assert.Equal(HttpStatusCode.TooManyRequests, (await AttemptAsync(attacker, PrivatePreviewApiFactory.Passphrase)).StatusCode);

        factory.Time.Advance(TimeSpan.FromSeconds(60));
        Assert.Equal(HttpStatusCode.SeeOther, (await AttemptAsync(attacker, PrivatePreviewApiFactory.Passphrase)).StatusCode);
    }

    [Fact]
    public async Task Lockouts_never_last_more_than_an_hour()
    {
        var attacker = factory.Browser();
        for (var round = 0; round < 8; round++)
        {
            await FailAsync(attacker, 5);
            factory.Time.Advance(TimeSpan.FromMinutes(61));
        }

        Assert.Equal(HttpStatusCode.SeeOther, (await AttemptAsync(attacker, PrivatePreviewApiFactory.Passphrase)).StatusCode);
    }

    [Fact]
    public async Task A_success_resets_the_count()
    {
        var owner = factory.Browser();
        await FailAsync(owner, 4);
        Assert.Equal(HttpStatusCode.SeeOther, (await AttemptAsync(owner, PrivatePreviewApiFactory.Passphrase)).StatusCode);

        await FailAsync(owner, 4);

        Assert.Equal(HttpStatusCode.SeeOther, (await AttemptAsync(owner, PrivatePreviewApiFactory.Passphrase)).StatusCode);
    }

    [Fact]
    public async Task Refusals_older_than_15_minutes_do_not_count()
    {
        var owner = factory.Browser();
        await FailAsync(owner, 4);
        factory.Time.Advance(TimeSpan.FromMinutes(16));

        await FailAsync(owner, 1);

        Assert.Equal(HttpStatusCode.SeeOther, (await AttemptAsync(owner, PrivatePreviewApiFactory.Passphrase)).StatusCode);
    }

    [Fact]
    public async Task Behind_the_ingress_the_address_is_the_last_forwarded_entry()
    {
        await using var app = factory.WithWebHostBuilder(b => b.UseSetting("FORWARDEDHEADERS_ENABLED", "true"));
        HttpClient Client(string forwardedFor)
        {
            var client = app.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
            client.BaseAddress = new Uri(CommunityApiFactory.WebAppOrigin);
            client.DefaultRequestHeaders.Add("X-Forwarded-For", forwardedFor);
            return client;
        }

        // The attacker varies the entry it sends; the ingress appends the real address last.
        for (var i = 0; i < 5; i++)
        {
            await AttemptAsync(Client($"192.0.2.{i}, 203.0.113.9"), Wrong);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await AttemptAsync(Client("198.51.100.1, 203.0.113.9"), PrivatePreviewApiFactory.Passphrase)).StatusCode);
        Assert.Equal(HttpStatusCode.SeeOther, (await AttemptAsync(Client("203.0.113.9, 198.51.100.2"), PrivatePreviewApiFactory.Passphrase)).StatusCode);
    }

    private static async Task FailAsync(HttpClient client, int times)
    {
        for (var i = 0; i < times; i++)
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await AttemptAsync(client, Wrong)).StatusCode);
        }
    }

    /// <summary>Opens the wall and submits it from <paramref name="client"/>, as one visitor would.</summary>
    internal static async Task<HttpResponseMessage> AttemptAsync(HttpClient client, string passphrase)
    {
        var page = await client.SendAsync(LockedRequestTests.Navigation(HttpMethod.Get, "/"));
        var html = await page.Content.ReadAsStringAsync();
        var csrf = System.Text.RegularExpressions.Regex.Match(html, "name=\"csrf\" value=\"([^\"]+)\"").Groups[1].Value;
        var cookie = page.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("__Host-wall=", StringComparison.Ordinal));
        var request = new HttpRequestMessage(HttpMethod.Post, "/__wall/unlock")
        {
            Content = new FormUrlEncodedContent([new("csrf", csrf), new("returnUrl", "/"), new("passphrase", passphrase)]),
        };
        request.Headers.Add("Cookie", cookie[..cookie.IndexOf(';')]);
        return await client.SendAsync(request);
    }
}

// Traces to: L2-103 AC3. Its own fixture: a global lockout shuts everyone out.
public class GlobalLockoutTests(PrivatePreviewApiFactory factory) : IClassFixture<PrivatePreviewApiFactory>
{
    [Fact]
    public async Task One_hundred_refusals_from_anywhere_lock_everyone_out_for_15_minutes_then_twice_as_long()
    {
        await RefuseFromManyAddressesAsync(100);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await BruteForceTests.AttemptAsync(factory.Browser(), PrivatePreviewApiFactory.Passphrase)).StatusCode);
        factory.Time.Advance(TimeSpan.FromMinutes(14));
        Assert.Equal(HttpStatusCode.TooManyRequests, (await BruteForceTests.AttemptAsync(factory.Browser(), PrivatePreviewApiFactory.Passphrase)).StatusCode);
        factory.Time.Advance(TimeSpan.FromMinutes(2));
        Assert.Equal(HttpStatusCode.SeeOther, (await BruteForceTests.AttemptAsync(factory.Browser(), PrivatePreviewApiFactory.Passphrase)).StatusCode);

        await RefuseFromManyAddressesAsync(100);
        factory.Time.Advance(TimeSpan.FromMinutes(16));
        Assert.Equal(HttpStatusCode.TooManyRequests, (await BruteForceTests.AttemptAsync(factory.Browser(), PrivatePreviewApiFactory.Passphrase)).StatusCode);
    }

    private async Task RefuseFromManyAddressesAsync(int count)
    {
        // Two refusals per address: never enough for a per-address lockout.
        await Parallel.ForEachAsync(Enumerable.Range(0, count / 2), new ParallelOptions { MaxDegreeOfParallelism = 8 }, async (_, _) =>
        {
            var client = factory.Browser();
            for (var i = 0; i < 2; i++)
            {
                Assert.Equal(HttpStatusCode.Forbidden, (await BruteForceTests.AttemptAsync(client, "wrong")).StatusCode);
            }
        });
    }
}

/// <summary>
/// Handlers log through Serilog's static logger, which the most recently started host owns, so this test runs alone:
/// no other host may start while it reads its own host's logs.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public class StaticLoggerCollection
{
    public const string Name = "Serilog static logger";
}

// Traces to: L2-103 AC4.
[Collection(StaticLoggerCollection.Name)]
public class UnlockLoggingTests(PrivatePreviewApiFactory factory) : IClassFixture<PrivatePreviewApiFactory>
{
    private const string Wrong = BruteForceTests.Wrong;

    [Fact]
    public async Task Refusals_and_lockouts_are_logged_without_the_input()
    {
        var logs = new CapturingLogSink();
        await using var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<ILogEventSink>(logs)));
        var client = app.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false });
        client.BaseAddress = new Uri(CommunityApiFactory.WebAppOrigin);
        client.DefaultRequestHeaders.Add(PrivatePreviewApiFactory.ClientHeader, "10.9.8.7");

        for (var i = 0; i < 6; i++)
        {
            await BruteForceTests.AttemptAsync(client, Wrong);
        }

        var rendered = logs.Rendered().ToList();
        Assert.Contains(rendered, line => line.Contains("refused", StringComparison.Ordinal) && line.Contains("10.9.8.7", StringComparison.Ordinal));
        Assert.Contains(rendered, line => line.Contains("locked out", StringComparison.Ordinal) && line.Contains("10.9.8.7", StringComparison.Ordinal));
        Assert.DoesNotContain(rendered, line => line.Contains(Wrong, StringComparison.Ordinal));
        Assert.DoesNotContain(logs.Events.SelectMany(e => e.Properties.Keys), key =>
            key.Contains("Passphrase", StringComparison.OrdinalIgnoreCase) || key.Contains("Length", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(rendered, line => line.Contains("__Host-wall=", StringComparison.Ordinal));
    }
}
