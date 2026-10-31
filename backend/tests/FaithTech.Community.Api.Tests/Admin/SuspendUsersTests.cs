// Traces to: L2-039, L2-003, L2-041
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Admin;

public class SuspendUsersTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    private readonly OidcFlow _flow = new(factory);

    [Fact]
    public async Task System_admin_suspends_with_a_reason_revoking_sessions_and_refusing_sign_in()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var email = await _flow.CreateAccountAsync();
        var tokens = await _flow.SignInAndGetTokensAsync(email);
        var profileId = await ProfileOfAsync(email);

        var response = await factory.ClientFor(priya, Role.SystemAdmin)
            .PostAsJsonAsync($"/api/admin/users/{profileId}/suspension", new { Reason = "  Repeated spam event listings.  " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var profile = await factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == profileId));
        Assert.True(profile.IsSuspended);
        Assert.Equal("Repeated spam event listings.", profile.SuspendedReason);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _flow.Api(tokens.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _flow.RefreshAsync(tokens.RefreshToken)).StatusCode);
        var signIn = await new OidcFlow(factory).SignInAsync(email);
        Assert.Equal("suspended", (await signIn.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());

        var entry = await factory.WithDbAsync(db => db.AuditEntries.SingleAsync(a => a.TargetId == profileId.ToString()));
        Assert.Equal("user.suspended", entry.Action);
        Assert.Equal(priya.ProfileId, entry.ActorId);
        Assert.Contains("Repeated spam event listings.", entry.AfterJson);
    }

    [Fact]
    public async Task Reinstated_user_can_sign_in_again()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var email = await _flow.CreateAccountAsync();
        var profileId = await ProfileOfAsync(email);
        var admin = factory.ClientFor(priya, Role.SystemAdmin);
        await admin.PostAsJsonAsync($"/api/admin/users/{profileId}/suspension", new { Reason = "Misuse" });

        var response = await admin.DeleteAsync($"/api/admin/users/{profileId}/suspension");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await new OidcFlow(factory).SignInAsync(email)).StatusCode);
        Assert.True(await factory.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.TargetId == profileId.ToString() && a.Action == "user.reinstated")));
    }

    [Theory]
    [InlineData]
    [InlineData(Role.Staff)]
    [InlineData(Role.CityLead)]
    public async Task Any_other_role_gets_403(params Role[] roles)
    {
        var caller = await factory.AddMemberAsync("Grace Okonkwo");
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var client = factory.ClientFor(caller, roles);

        var suspend = await client.PostAsJsonAsync($"/api/admin/users/{leah.ProfileId}/suspension", new { Reason = "No" });
        var reinstate = await client.DeleteAsync($"/api/admin/users/{leah.ProfileId}/suspension");

        Assert.Equal(HttpStatusCode.Forbidden, suspend.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, reinstate.StatusCode);
        Assert.False((await factory.WithDbAsync(db => db.Profiles.AsNoTracking().SingleAsync(p => p.Id == leah.ProfileId))).IsSuspended);
    }

    [Theory]
    [InlineData("", "Give a reason so other admins understand.")]
    [InlineData(501, "Use 500 characters or fewer for the reason.")]
    public async Task A_reason_is_required_and_limited(object reason, string message)
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var value = reason is int length ? new string('r', length) : (string)reason;

        var response = await factory.ClientFor(priya, Role.SystemAdmin)
            .PostAsJsonAsync($"/api/admin/users/{leah.ProfileId}/suspension", new { Reason = value });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal([message], problem!.Errors["Reason"]);
    }

    [Fact]
    public async Task Admin_cannot_suspend_themselves_and_state_conflicts_are_409()
    {
        var priya = await factory.AddMemberAsync("Priya Shah");
        var leah = await factory.AddMemberAsync("Leah Thompson");
        var admin = factory.ClientFor(priya, Role.SystemAdmin);

        var self = await admin.PostAsJsonAsync($"/api/admin/users/{priya.ProfileId}/suspension", new { Reason = "Test" });
        var notSuspended = await admin.DeleteAsync($"/api/admin/users/{leah.ProfileId}/suspension");
        await admin.PostAsJsonAsync($"/api/admin/users/{leah.ProfileId}/suspension", new { Reason = "Spam" });
        var twice = await admin.PostAsJsonAsync($"/api/admin/users/{leah.ProfileId}/suspension", new { Reason = "Spam" });
        var unknown = await admin.PostAsJsonAsync($"/api/admin/users/{Guid.NewGuid()}/suspension", new { Reason = "Spam" });

        Assert.Equal(HttpStatusCode.Conflict, self.StatusCode);
        Assert.Equal("You can’t suspend your own account.", (await self.Content.ReadFromJsonAsync<ProblemDetails>())!.Detail);
        Assert.Equal(HttpStatusCode.Conflict, notSuspended.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, twice.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    private Task<Guid> ProfileOfAsync(string email) =>
        factory.WithDbAsync(db => db.Users.Where(u => u.Email == email).Join(db.Profiles, u => (Guid?)u.Id, p => p.UserId, (u, p) => p.Id).SingleAsync());
}
