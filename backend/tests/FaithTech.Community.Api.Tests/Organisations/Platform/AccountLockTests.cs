// Traces to: L2-148 AC4, AC5; L2-132 AC6; L2-003 AC4; L2-152 AC4
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations.Platform;

// An operator locks an account across the platform: refused on every host, every session revoked; unlocking undoes it.
public class AccountLockTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record AuditItem(string OperatorEmail, string Source, string Action, string? OrganisationSlug, string Target);

    public sealed record AuditPage(List<AuditItem> Items, int TotalCount);

    // An account with a profile on FaithTech (it signed up there) and on Northside.
    private async Task<(string Email, OrganisationScopes.OtherOrganisation Northside)> MemberOfTwoAsync()
    {
        var flow = new OidcFlow(factory);
        var email = await flow.CreateAccountAsync();
        var northside = await factory.AddOrganisationAsync();
        var userId = await factory.WithDbAsync(db => db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync());
        await factory.AddMembershipAsync(northside, userId, "Victor Kane");
        return (email, northside);
    }

    private static async Task<string?> SignInCodeAsync(HttpResponseMessage response) =>
        response.IsSuccessStatusCode ? null : (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    [Fact]
    public async Task Locking_refuses_the_account_on_every_host_and_revokes_its_sessions()
    {
        var (email, northside) = await MemberOfTwoAsync();
        var flow = new OidcFlow(factory);
        var tokens = await flow.SignInAndGetTokensAsync(email);
        var operatorClient = await factory.OperatorClientAsync();

        var response = await operatorClient.PostAsJsonAsync($"/api/platform/accounts/{email}/lock", new { Reason = "  Spam across organisations  " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var user = await factory.WithDbAsync(db => db.Users.AsNoTracking().SingleAsync(u => u.Email == email));
        Assert.True(user.IsLocked);
        Assert.Equal("Spam across organisations", user.LockedReason);
        Assert.NotNull(user.LockedAtUtc);
        Assert.Equal(HttpStatusCode.Unauthorized, (await flow.Api(tokens.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await flow.RefreshAsync(tokens.RefreshToken)).StatusCode);
        Assert.Equal("suspended", await SignInCodeAsync(await new OidcFlow(factory).SignInAsync(email)));
        Assert.Equal("suspended", await SignInCodeAsync(await new OidcFlow(factory, northside.Origin).SignInAsync(email)));
    }

    [Fact]
    public async Task Unlocking_lets_the_account_sign_in_again_and_both_actions_are_on_the_platform_audit()
    {
        var (email, northside) = await MemberOfTwoAsync();
        var operatorClient = await factory.OperatorClientAsync();
        (await operatorClient.PostAsJsonAsync($"/api/platform/accounts/{email}/lock", new { Reason = "Mistaken report" })).EnsureSuccessStatusCode();
        factory.Time.Advance(TimeSpan.FromMinutes(1));

        var response = await operatorClient.PostAsync($"/api/platform/accounts/{email.ToUpperInvariant()}/unlock", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await SignInCodeAsync(await new OidcFlow(factory).SignInAsync(email)));
        Assert.Null(await SignInCodeAsync(await new OidcFlow(factory, northside.Origin).SignInAsync(email)));
        var audit = await operatorClient.GetFromJsonAsync<AuditPage>("/api/platform/audit?pageSize=100");
        Assert.Equal(["account.unlocked", "account.locked"], audit!.Items.Where(i => i.Target == email).Select(i => i.Action));
    }

    [Fact]
    public async Task A_lock_needs_a_reason_and_an_existing_account()
    {
        var (email, _) = await MemberOfTwoAsync();
        var operatorClient = await factory.OperatorClientAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await operatorClient.PostAsJsonAsync($"/api/platform/accounts/{email}/lock", new { Reason = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await operatorClient.PostAsJsonAsync("/api/platform/accounts/nobody@example.org/lock", new { Reason = "Spam" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await operatorClient.PostAsync("/api/platform/accounts/nobody@example.org/unlock", null)).StatusCode);
    }

    [Fact]
    public async Task A_member_cannot_lock_an_account()
    {
        var (email, _) = await MemberOfTwoAsync();
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);

        var response = await admin.PostAsJsonAsync($"/api/platform/accounts/{email}/lock", new { Reason = "Spam" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.False((await factory.WithDbAsync(db => db.Users.AsNoTracking().SingleAsync(u => u.Email == email))).IsLocked);
    }

    [Fact]
    public async Task Platform_audit_entries_never_reach_an_organisations_audit_log()
    {
        var (email, _) = await MemberOfTwoAsync();
        var operatorClient = await factory.OperatorClientAsync();

        (await operatorClient.PostAsJsonAsync($"/api/platform/accounts/{email}/lock", new { Reason = "Spam across organisations" })).EnsureSuccessStatusCode();

        var platform = await operatorClient.GetFromJsonAsync<AuditPage>("/api/platform/audit?pageSize=100");
        var locked = Assert.Single(platform!.Items, i => i.Target == email);
        Assert.Equal(
            ("account.locked", CommunityApiFactory.OperatorEmail, "Api", (string?)null),
            (locked.Action, locked.OperatorEmail, locked.Source, locked.OrganisationSlug));
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);
        var organisationAudit = await admin.GetStringAsync("/api/admin/audit");
        Assert.DoesNotContain("account.locked", organisationAudit);
        Assert.DoesNotContain(email, organisationAudit);
    }
}
