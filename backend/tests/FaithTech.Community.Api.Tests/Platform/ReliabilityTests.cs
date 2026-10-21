using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Platform;

public class ReliabilityTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")]
    public async Task Health_probes_report_healthy_without_authentication(string path)
    {
        var response = await factory.CreateClient().GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Readiness_reports_unhealthy_when_the_database_is_unreachable()
    {
        var client = factory.WithWebHostBuilder(b =>
            b.UseSetting("ConnectionStrings:Community", "Host=127.0.0.1;Port=1;Database=x;Timeout=2")).CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
    }

    [Fact]
    public async Task Response_echoes_the_incoming_correlation_id()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.Add("X-Correlation-ID", "abc-123");

        var response = await factory.CreateClient().SendAsync(request);

        Assert.Equal("abc-123", Assert.Single(response.Headers.GetValues("X-Correlation-ID")));
    }

    [Fact]
    public async Task Response_carries_a_generated_correlation_id_when_none_is_sent()
    {
        var response = await factory.CreateClient().GetAsync("/health/live");

        Assert.False(string.IsNullOrWhiteSpace(Assert.Single(response.Headers.GetValues("X-Correlation-ID"))));
    }

    [Fact]
    public async Task Unhandled_exception_returns_problem_details_with_the_correlation_id()
    {
        var client = factory.WithWebHostBuilder(b =>
            b.ConfigureServices(s => s.AddTransient<IStartupFilter, ThrowingStartupFilter>()
                .AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null))).CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, Guid.NewGuid().ToString());

        var response = await client.GetAsync("/boom");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        var correlationId = Assert.Single(response.Headers.GetValues("X-Correlation-ID"));
        Assert.Equal(correlationId, problem!.Extensions["traceId"]?.ToString());
        Assert.DoesNotContain("InvalidOperationException", await response.Content.ReadAsStringAsync());
    }

    private sealed class ThrowingStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            next(app);
            app.Run(_ => throw new InvalidOperationException("boom"));
        };
    }
}
