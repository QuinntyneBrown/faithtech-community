// Traces to: L2-009, L2-042
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Admin;

/// <summary>
/// Real tokens from the code + PKCE flow: the server authorizes with the caller's current roles, not the
/// roles copied into the token when it was issued.
/// </summary>
public class RoleFreshnessTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private readonly OidcFlow _flow = new(factory);

    [Fact]
    public async Task A_removed_City_Lead_role_stops_working_on_the_token_issued_before_the_removal()
    {
        var (email, profileId) = await AccountWithRolesAsync(Role.CityLead);
        var api = _flow.Api((await _flow.SignInAndGetTokensAsync(email)).AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await api.GetAsync("/api/invites")).StatusCode);

        var removed = await (await AdminClientAsync()).DeleteAsync($"/api/profiles/{profileId}/roles/{factory.RoleIdOf("CityLead")}");
        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await api.GetAsync("/api/invites")).StatusCode);
        var invite = await api.PostAsJsonAsync("/api/invites", new { Email = $"{Guid.NewGuid():N}@example.org" });
        Assert.Equal(HttpStatusCode.Forbidden, invite.StatusCode);
    }

    [Fact]
    public async Task A_removed_System_Admin_is_refused_with_the_old_token_and_after_refreshing_it()
    {
        var (email, profileId) = await AccountWithRolesAsync(Role.SystemAdmin);
        var tokens = await _flow.SignInAndGetTokensAsync(email);
        var api = _flow.Api(tokens.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await api.GetAsync("/api/admin/users")).StatusCode);

        var removed = await (await AdminClientAsync()).DeleteAsync($"/api/profiles/{profileId}/roles/{factory.RoleIdOf("SystemAdmin")}");
        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await api.GetAsync("/api/admin/users")).StatusCode);
        var refreshed = await _flow.RefreshAsync(tokens.RefreshToken);
        refreshed.EnsureSuccessStatusCode();
        var renewed = _flow.Api((await refreshed.Content.ReadFromJsonAsync<TokenResponse>())!.AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await renewed.GetAsync("/api/admin/users")).StatusCode);
        Assert.Empty((await renewed.GetFromJsonAsync<JsonElement>("/api/me")).GetProperty("roles").EnumerateArray());
    }

    [Fact]
    public async Task An_added_role_is_shown_and_honoured_once_the_session_is_refreshed()
    {
        var (email, profileId) = await AccountWithRolesAsync();
        var tokens = await _flow.SignInAndGetTokensAsync(email);

        var added = await (await AdminClientAsync()).PostAsJsonAsync($"/api/profiles/{profileId}/roles", new { RoleId = factory.RoleIdOf("CityLead") });
        Assert.Equal(HttpStatusCode.OK, added.StatusCode);

        var refreshed = await _flow.RefreshAsync(tokens.RefreshToken);
        refreshed.EnsureSuccessStatusCode();
        var api = _flow.Api((await refreshed.Content.ReadFromJsonAsync<TokenResponse>())!.AccessToken);
        var roles = (await api.GetFromJsonAsync<JsonElement>("/api/me")).GetProperty("roles").EnumerateArray().Select(r => r.GetProperty("key").GetString());
        Assert.Equal(["CityLead"], roles);
        Assert.Equal(HttpStatusCode.OK, (await api.GetAsync("/api/invites")).StatusCode);
    }

    private async Task<(string Email, Guid ProfileId)> AccountWithRolesAsync(params Role[] roles)
    {
        var email = await _flow.CreateAccountAsync();
        var profileId = await factory.WithDbAsync(async db =>
        {
            var id = await db.Users.Where(u => u.Email == email).Join(db.Profiles, u => (Guid?)u.Id, p => p.UserId, (u, p) => p.Id).SingleAsync();
            var profile = await db.Profiles.SingleAsync(p => p.Id == id);
            foreach (var role in roles)
            {
                profile.AddRole(role, Guid.Empty, DateTime.UtcNow);
            }

            await db.SaveChangesAsync();
            return id;
        });
        return (email, profileId);
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var admin = await factory.AddMemberAsync("Priya Raman", p => p.AddRole(Role.SystemAdmin, Guid.Empty, DateTime.UtcNow));
        return factory.ClientFor(admin, Role.SystemAdmin);
    }
}
