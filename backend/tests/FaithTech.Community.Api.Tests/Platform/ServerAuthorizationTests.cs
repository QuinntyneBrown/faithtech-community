using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Platform;

public partial class ServerAuthorizationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    // Endpoints the design marks anonymous (L2-042 AC1), plus the health probes (L2-047) and the invite link (L2-011).
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
        "api/invites/by-token/{token}",
        "api/invites/accept",
    ];

    [Fact]
    public async Task Every_endpoint_returns_401_without_authentication_unless_marked_anonymous()
    {
        var client = factory.CreateClient();
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"])
                .Select(method => (method, route: e.RoutePattern.RawText!.TrimStart('/'))))
            .ToList();
        Assert.Contains(endpoints, e => e.route == "api/me");

        foreach (var (method, route) in endpoints)
        {
            var path = "/" + RouteParameter().Replace(route, Guid.NewGuid().ToString());
            var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

            if (AnonymousRoutes.Contains(route))
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
        Assert.Equal(["CityLead", "Staff"], me.Roles);
    }

    private sealed record MeResponse(Guid Id, string[] Roles);

    [GeneratedRegex(@"\{[^}]+\}")]
    private static partial Regex RouteParameter();
}
