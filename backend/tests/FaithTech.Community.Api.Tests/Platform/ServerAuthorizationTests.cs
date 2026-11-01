using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Platform;

public partial class ServerAuthorizationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    // Endpoints the design marks anonymous (L2-042 AC1), plus the health probes (L2-047), the invite link (L2-011) and
    // public events with guest RSVP (L2-023) and the connect link lookup and sign-up.
    private static readonly string[] AnonymousRoutes =
    [
        "health/live",
        "health/ready",
        "api/account/sign-up",
        "api/account/verify-email",
        "api/account/resend-verification",
        "api/account/forgot-password",
        "api/account/reset-password",
        "connect/authorize",
        "connect/token",
        "connect/logout",
        "connect/revoke",
        "api/account/sign-in",
        "api/invites/lookup",
        "api/invites/accept",
        "api/connect/lookup",
        "api/connect/sign-up",
        "api/public/events/{id:guid}",
        "api/public/events/{id:guid}/rsvps",
        "api/public/events/{id:guid}/rsvps/cancel",
        "api/public/events/{id:guid}/calendar.ics",
        // The hub page (L2-166 AC1, ADR 0040): anyone may ask; the handler answers only what the caller may see.
        "api/events/{id:guid}/hub/page",
        "api/announcements/unsubscribe",
        // Google sign-in (L2-078) redirects to Google without a session; the client follows it to Google's host, which
        // the API does not serve (L2-131 AC2).
        "api/account/google/start",
        // The organisation's names, read by the pages that render before sign-in (L2-134 AC1).
        "api/site",
    ];

    [Fact]
    public async Task Every_endpoint_returns_401_without_authentication_unless_marked_anonymous()
    {
        // One request per endpoint from one address: more endpoints than the global limit of 100 a minute.
        var client = factory.WithWebHostBuilder(b => b.UseSetting("RateLimits:PerMinute", "100000")).CreateClient();
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"])
                .Select(method => (method, route: e.RoutePattern.RawText!.TrimStart('/'))))
            .ToList();
        Assert.Contains(endpoints, e => e.route == "api/me");

        foreach (var (method, route) in endpoints)
        {
            var path = "/" + RouteParameter().Replace(route, Guid.NewGuid().ToString());
            var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

            if (route.StartsWith("api/platform/", StringComparison.Ordinal))
            {
                // The operator API hides itself: an empty 404, never 401 (L2-148 AC2).
                Assert.True(response.StatusCode == HttpStatusCode.NotFound, $"{method} {route} returned {response.StatusCode}");
            }
            else if (AnonymousRoutes.Contains(route))
            {
                Assert.True(response.StatusCode != HttpStatusCode.Unauthorized, $"{method} {route} should be anonymous");
            }
            else
            {
                Assert.True(response.StatusCode == HttpStatusCode.Unauthorized, $"{method} {route} returned {response.StatusCode}");
            }
        }
    }

    [Fact]
    public async Task Me_returns_the_signed_in_user_and_roles()
    {
        // The roles come from the profile, so the member really holds them.
        var member = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(member, Role.CityLead, Role.Staff);

        var me = await client.GetFromJsonAsync<MeResponse>("/api/me");

        Assert.Equal(member.UserId, me!.Id);
        Assert.Equal(["City Lead", "Staff"], me.Roles.Select(r => r.Name));
    }

    private sealed record HeldRole(string Name);

    private sealed record MeResponse(Guid Id, HeldRole[] Roles);

    [GeneratedRegex(@"\{[^}]+\}")]
    private static partial Regex RouteParameter();
}
