using System.Net;
using System.Net.Http.Headers;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-131 AC1 to AC5, L2-048 (docs/detailed-designs/organisations/tenancy-and-host-resolution).
public class HostResolutionTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private const string UnknownHost = "https://app.nobody.test";
    private const string SuspendedHost = "https://app.paused.test";
    private const string ActiveHost = "https://app.northside.test";

    [Fact]
    public async Task A_known_host_reaches_the_api()
    {
        await ArrangeOrganisationsAsync();

        var response = await Client(ActiveHost).GetAsync("/api/me");

        // Unauthenticated, so the endpoint itself answers: the host was resolved and the request went on.
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task The_test_host_resolves_to_FaithTech_so_the_suite_runs_unchanged()
    {
        var response = await Client("http://localhost").GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/")]
    [InlineData("GET", "/events")]
    [InlineData("GET", "/api/me")]
    public async Task An_unknown_host_answers_a_navigation_with_the_neutral_404_page(string method, string path)
    {
        var response = await Client(UnknownHost).SendAsync(Navigation(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("There’s nothing here", html);
        Assert.Contains("Check the address and try again.", html);
        Assert.DoesNotContain("FaithTech", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("community", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<script", html);
        var policy = response.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Matches("style-src 'nonce-[^']+'", policy);
        Assert.Contains("default-src 'none'", policy);
    }

    [Fact]
    public async Task A_head_navigation_on_an_unknown_host_gets_404_with_no_body()
    {
        var response = await Client(UnknownHost).SendAsync(Navigation(HttpMethod.Head, "/"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
    }

    [Theory]
    [InlineData("GET", "/api/me")]
    [InlineData("POST", "/api/account/sign-in")]
    [InlineData("POST", "/connect/token")]
    [InlineData("GET", "/.well-known/openid-configuration")]
    [InlineData("POST", "/hubs/agile/negotiate?negotiateVersion=1")]
    [InlineData("GET", "/health/ready")]
    [InlineData("DELETE", "/api/contacts/0b7d3c1e-0000-0000-0000-000000000001")]
    public async Task Anything_else_on_an_unknown_host_gets_an_empty_404(string method, string path)
    {
        var response = await Client(UnknownHost).SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    [Theory]
    [InlineData(UnknownHost)]
    [InlineData(SuspendedHost)]
    public async Task The_liveness_check_answers_on_every_host(string host)
    {
        await ArrangeOrganisationsAsync();

        var response = await Client(host).GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/sign-in")]
    public async Task A_suspended_organisation_answers_a_navigation_with_the_neutral_503_page(string path)
    {
        await ArrangeOrganisationsAsync();

        var response = await Client(SuspendedHost).SendAsync(Navigation(HttpMethod.Get, path));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("This site is unavailable", html);
        Assert.DoesNotContain("Paused Fellowship", html);
        Assert.DoesNotContain("FaithTech", html, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("GET", "/api/me")]
    [InlineData("POST", "/api/account/sign-in")]
    [InlineData("POST", "/connect/token")]
    [InlineData("GET", "/connect/authorize?client_id=web&response_type=code")]
    public async Task A_suspended_organisation_serves_no_sign_in_or_api_call(string method, string path)
    {
        await ArrangeOrganisationsAsync();

        var response = await Client(SuspendedHost).SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Host_names_are_compared_case_insensitively()
    {
        await ArrangeOrganisationsAsync();

        var response = await Client("https://APP.Northside.TEST").GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("X-Organisation", "northside")]
    [InlineData("X-Organisation-Id", "0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b6c01")]
    [InlineData("Cookie", "organisation=faithtech")]
    public async Task Only_the_host_decides_never_a_header_or_cookie(string header, string value)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        request.Headers.TryAddWithoutValidation(header, value);

        var response = await Client(UnknownHost).SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Only_the_host_decides_never_the_query_string()
    {
        var response = await Client(UnknownHost).GetAsync("/api/me?organisation=faithtech&organisationId=" + FaithTechSeed.OrganisationId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Outside_development_a_loopback_host_is_an_unknown_host()
    {
        await using var staging = factory.WithWebHostBuilder(b => b.UseEnvironment("Staging"));

        var response = await staging.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://localhost") })
            .GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task In_development_localhost_is_the_default_organisation()
    {
        await using var development = factory.WithWebHostBuilder(b => b
            .UseEnvironment("Development")
            .UseSetting("WebApp:Origin", "http://localhost:4200"));

        var response = await development.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://localhost:5000") })
            .GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task The_marketing_host_keeps_working()
    {
        var response = await Client(CommunityApiFactory.MarketingOrigin).GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private HttpClient Client(string origin) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri(origin), AllowAutoRedirect = false });

    private static HttpRequestMessage Navigation(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/html"));
        return request;
    }

    private Task ArrangeOrganisationsAsync() => factory.WithDbAsync(async db =>
    {
        if (!await db.Organisations.AnyAsync(o => o.Slug == "northside"))
        {
            var now = DateTime.UtcNow;
            db.Organisations.Add(new Organisation(Guid.NewGuid(), "northside", "app.northside.test", "Northside Church", "Northside", now));
            var paused = new Organisation(Guid.NewGuid(), "paused", "app.paused.test", "Paused Fellowship", "Paused", now);
            paused.Suspend("Unpaid invoice", now);
            db.Organisations.Add(paused);
            await db.SaveChangesAsync();
        }

        return true;
    });
}
