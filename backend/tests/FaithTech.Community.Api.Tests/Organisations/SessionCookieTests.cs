using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FaithTech.Community.Api.Tests.Organisations;

// Traces to: L2-133 AC3. The identity server's sign-in cookie reaches every host under Identity:CookieDomain, so
// switching organisation finds the session without asking for credentials; unset, the cookie stays host-only.
public class SessionCookieTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    [Fact]
    public async Task The_sign_in_cookie_is_host_only_by_default()
    {
        var cookie = await SignInCookieAsync(factory.CreateClient());

        Assert.DoesNotContain("domain=", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task The_sign_in_cookie_covers_the_configured_domain()
    {
        var client = factory.WithWebHostBuilder(b => b.UseSetting("Identity:CookieDomain", ".faithtech.test"))
            .CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

        var cookie = await SignInCookieAsync(client);

        Assert.Contains("domain=.faithtech.test", cookie, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<string> SignInCookieAsync(HttpClient client)
    {
        var email = await new OidcFlow(factory).CreateAccountAsync();
        var response = await client.PostAsJsonAsync("/api/account/sign-in", new { email, password = OidcFlow.Password });
        response.EnsureSuccessStatusCode();
        return Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("ftc.session=", StringComparison.Ordinal));
    }
}
