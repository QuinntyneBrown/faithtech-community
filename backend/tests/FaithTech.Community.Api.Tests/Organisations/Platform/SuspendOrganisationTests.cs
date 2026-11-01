// Traces to: L2-150 AC1, AC2, AC3, AC5; L2-131 AC3
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Identity;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations.Platform;

// An operator suspends an organisation with a reason and lifts it; nothing else is touched.
public class SuspendOrganisationTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record AuditItem(string OperatorEmail, string Source, string Action, string? OrganisationSlug, string Target, string? Details);

    public sealed record AuditPage(List<AuditItem> Items, int TotalCount);

    // An account with a profile on FaithTech (it signed up there) and on a second organisation of its own.
    private async Task<(string Email, string Slug, OrganisationScopes.OtherOrganisation Other)> MemberOfTwoAsync()
    {
        var email = await new OidcFlow(factory).CreateAccountAsync();
        var slug = $"s{Guid.NewGuid():N}"[..20];
        var other = await factory.AddOrganisationAsync(slug);
        var userId = await factory.WithDbAsync(db => db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync());
        await factory.AddMembershipAsync(other, userId, "Victor Kane");
        return (email, slug, other);
    }

    private Task<Organisation> LoadAsync(string slug) =>
        factory.WithDbAsync(db => db.Organisations.AsNoTracking().SingleAsync(o => o.Slug == slug));

    private HttpClient On(string origin) => factory.CreateClient(new() { BaseAddress = new Uri(origin) });

    [Fact]
    public async Task Suspending_closes_its_hosts_revokes_its_sessions_and_leaves_the_members_other_organisation_alone()
    {
        var (email, slug, other) = await MemberOfTwoAsync();
        var there = await new OidcFlow(factory, other.Origin).SignInAndGetTokensAsync(email);
        var home = new OidcFlow(factory);
        var here = await home.SignInAndGetTokensAsync(email);
        var operatorClient = await factory.OperatorClientAsync();

        var response = await operatorClient.PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = "  Unpaid since March  " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var organisation = await LoadAsync(slug);
        Assert.Equal((OrganisationStatus.Suspended, "Unpaid since March"), (organisation.Status, organisation.SuspendedReason));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await On(other.Origin).GetAsync("/api/site")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await new OidcFlow(factory).RefreshAsync(there.RefreshToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await home.Api(here.AccessToken).GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await home.RefreshAsync(here.RefreshToken)).StatusCode);
        var audit = await operatorClient.GetFromJsonAsync<AuditPage>("/api/platform/audit?pageSize=100");
        var entry = Assert.Single(audit!.Items, i => i.Target == slug);
        Assert.Equal(("organisation.suspended", slug, "Api"), (entry.Action, entry.OrganisationSlug, entry.Source));
        Assert.Contains("Unpaid since March", entry.Details);
    }

    [Fact]
    public async Task Lifting_reopens_its_hosts_and_members_sign_in_again()
    {
        var (email, slug, other) = await MemberOfTwoAsync();
        var operatorClient = await factory.OperatorClientAsync();
        (await operatorClient.PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = "Investigating a report" })).EnsureSuccessStatusCode();
        factory.Time.Advance(TimeSpan.FromMinutes(1));

        var response = await operatorClient.PostAsync($"/api/platform/organisations/{slug}/lift", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var organisation = await LoadAsync(slug);
        Assert.Equal((OrganisationStatus.Active, null), (organisation.Status, organisation.SuspendedReason));
        Assert.Equal(HttpStatusCode.OK, (await On(other.Origin).GetAsync("/api/site")).StatusCode);
        var flow = new OidcFlow(factory, other.Origin);
        var tokens = await flow.SignInAndGetTokensAsync(email);
        var api = On(other.Origin);
        api.DefaultRequestHeaders.Authorization = new("Bearer", tokens.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await api.GetAsync("/api/me")).StatusCode);
        var audit = await operatorClient.GetFromJsonAsync<AuditPage>("/api/platform/audit?pageSize=100");
        Assert.Equal(["organisation.lifted", "organisation.suspended"], audit!.Items.Where(i => i.Target == slug).Select(i => i.Action));
    }

    [Fact]
    public async Task A_reason_is_needed_and_the_status_must_allow_the_change()
    {
        var (_, slug, _) = await MemberOfTwoAsync();
        var operatorClient = await factory.OperatorClientAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await operatorClient.PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = " " })).StatusCode);
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await operatorClient.PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = new string('a', 501) })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await operatorClient.PostAsync($"/api/platform/organisations/{slug}/lift", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await operatorClient.PostAsJsonAsync("/api/platform/organisations/nowhere-at-all/suspend", new { Reason = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await operatorClient.PostAsync("/api/platform/organisations/nowhere-at-all/lift", null)).StatusCode);
        (await operatorClient.PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = "First" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await operatorClient.PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = "Again" })).StatusCode);
        Assert.Equal(OrganisationStatus.Suspended, (await LoadAsync(slug)).Status);
    }

    [Fact]
    public async Task Anyone_but_an_operator_gets_404_and_nothing_changes()
    {
        var (_, slug, _) = await MemberOfTwoAsync();
        var admin = await factory.AddMemberAsync("Grace Okonkwo");
        var client = factory.ClientFor(admin, Role.SystemAdmin);

        var suspend = await client.PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = "Because" });
        var lift = await client.PostAsync($"/api/platform/organisations/{slug}/lift", null);
        var anonymous = await factory.CreateClient().PostAsJsonAsync($"/api/platform/organisations/{slug}/suspend", new { Reason = "Because" });

        Assert.Equal((HttpStatusCode.NotFound, HttpStatusCode.NotFound, HttpStatusCode.NotFound), (suspend.StatusCode, lift.StatusCode, anonymous.StatusCode));
        Assert.Equal(OrganisationStatus.Active, (await LoadAsync(slug)).Status);
    }
}
