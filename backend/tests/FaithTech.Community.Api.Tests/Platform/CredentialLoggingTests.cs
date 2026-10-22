// Traces to: L2-043, L2-047
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Middleware;
using FaithTech.Community.Api.Tests.Fakes;
using FaithTech.Community.Api.Tests.Invites;
using FaithTech.Community.Api.Tests.Profiles;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Serilog.Core;

namespace FaithTech.Community.Api.Tests.Platform;

/// <summary>Credentials never reach the logs, while the request log stays useful (L2-043, L2-047 AC2).</summary>
public class CredentialLoggingTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private readonly CapturingLogSink _logs = new();

    [Fact]
    public async Task Looking_up_an_invite_logs_the_request_but_never_the_invite_credential()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var (_, token) = await factory.AddInviteAsync(grace, "ruth.alvarez@example.org");
        var client = App().CreateClient();
        client.DefaultRequestHeaders.Add(CorrelationIdMiddleware.HeaderName, "lookup-correlation-1");

        var valid = await client.PostAsJsonAsync("/api/invites/lookup", new { token });
        var unknown = await client.PostAsJsonAsync("/api/invites/lookup", new { token = "synthetic-unknown-credential" });

        Assert.Equal(HttpStatusCode.OK, valid.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        AssertNoLogContains(token, "synthetic-unknown-credential");
        var completed = _logs.Events.Where(e => e.Properties.ContainsKey("StatusCode") && e.Properties.ContainsKey("Elapsed")).ToList();
        Assert.Contains(completed, e =>
            e.Properties["RequestMethod"].ToString() == "\"POST\""
            && e.Properties["StatusCode"].ToString() == "200"
            && e.Properties["CorrelationId"].ToString() == "\"lookup-correlation-1\"");
    }

    [Fact]
    public async Task A_credential_in_the_old_lookup_path_is_redacted_from_the_logs()
    {
        var grace = await factory.AddMemberAsync("Grace Okonkwo");
        var (_, token) = await factory.AddInviteAsync(grace, "felix@example.org");

        var response = await App().CreateClient().GetAsync($"/api/invites/by-token/{token}");

        Assert.False(response.IsSuccessStatusCode);
        AssertNoLogContains(token);
        Assert.Contains(_logs.Events, e => e.Properties.TryGetValue("RequestPath", out var path)
            && path.ToString() == "\"/api/invites/by-token/[redacted]\"");
    }

    [Fact]
    public async Task Passwords_and_tokens_sent_to_the_account_endpoints_stay_out_of_the_logs()
    {
        var client = App().CreateClient();
        const string password = "synthetic-password-for-logs";
        const string resetToken = "synthetic-reset-token-for-logs";

        await client.PostAsJsonAsync("/api/account/sign-in", new { email = "nobody@example.org", password });
        await client.PostAsJsonAsync("/api/account/reset-password", new { userId = Guid.NewGuid(), token = resetToken, password });
        await client.PostAsJsonAsync("/api/account/verify-email", new { userId = Guid.NewGuid(), token = resetToken });

        AssertNoLogContains(password, resetToken, "nobody@example.org");
    }

    private WebApplicationFactory<Program> App() =>
        factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<ILogEventSink>(_logs)));

    private void AssertNoLogContains(params string[] secrets)
    {
        var rendered = _logs.Rendered().ToList();
        Assert.NotEmpty(rendered);
        foreach (var secret in secrets)
        {
            Assert.DoesNotContain(rendered, line => line.Contains(secret, StringComparison.Ordinal));
        }
    }
}
