using System.Net;
using FaithTech.Community.Infrastructure.Identity;
using Microsoft.Extensions.Logging.Abstractions;

namespace FaithTech.Community.Infrastructure.Tests.Identity;

public class HibpBreachedPasswordCheckerTests
{
    // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    private const string Prefix = "5BAA6";
    private const string Suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

    [Fact]
    public async Task Sends_only_the_hash_prefix_and_reports_a_matching_suffix_as_breached()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent($"0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n{Suffix}:9545824\r\n"),
        });

        var breached = await Checker(handler).IsBreachedAsync("password");

        Assert.True(breached);
        Assert.Equal($"/range/{Prefix}", handler.LastRequest!.RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task Reports_a_password_without_a_matching_suffix_as_safe()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n"),
        });

        Assert.False(await Checker(handler).IsBreachedAsync("password"));
    }

    [Fact]
    public async Task Fails_open_when_the_service_is_unavailable()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("down"));

        Assert.False(await Checker(handler).IsBreachedAsync("password"));
    }

    private static HibpBreachedPasswordChecker Checker(StubHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://api.pwnedpasswords.com/") },
            NullLogger<HibpBreachedPasswordChecker>.Instance);

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(respond(request));
        }
    }
}
