// Traces to: L2-148 AC1, AC2, AC3, AC4; L2-152 AC4
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace FaithTech.Community.Api.Tests.Organisations.Platform;

// Platform operators are the accounts in Platform:Operators; the operator API is invisible to everyone else.
public class PlatformOperatorsTests(CommunityApiFactory factory) : IClassFixture<CommunityApiFactory>
{
    public sealed record Summary(string Slug, string Host, string Name, string ShortName, string Status, int AdministratorCount);

    public sealed record AuditItem(string OperatorEmail, string Source, string Action, string? OrganisationSlug, string Target);

    public sealed record AuditPage(List<AuditItem> Items, int TotalCount);

    [Theory]
    [InlineData("/api/platform/audit")]
    [InlineData("/api/platform/organisations/faithtech")]
    public async Task Anyone_but_an_operator_gets_an_empty_404(string path)
    {
        var admin = factory.ClientFor(await factory.AddMemberAsync("Priya Shah"), Role.SystemAdmin);
        var operatorClient = await factory.OperatorClientAsync();

        var anonymous = await factory.CreateClient().GetAsync(path);
        var member = await admin.GetAsync(path);

        Assert.Equal(HttpStatusCode.NotFound, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, member.StatusCode);
        Assert.Empty(await anonymous.Content.ReadAsByteArrayAsync());
        Assert.Empty(await member.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.OK, (await operatorClient.GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task The_operator_list_is_compared_without_case()
    {
        var operators = factory.Services.GetRequiredService<FaithTech.Community.Application.Organisations.Platform.IPlatformOperators>();

        Assert.True(operators.IsOperator("OPS@Platform.test"));
        Assert.False(operators.IsOperator("priya@example.org"));
    }

    [Fact]
    public async Task A_malformed_operator_email_stops_the_api_from_starting()
    {
        using var broken = factory.WithWebHostBuilder(b => b.UseSetting("Platform:Operators:0", "not-an-email"));

        var error = Assert.ThrowsAny<Exception>(() => broken.CreateClient());

        Assert.IsType<OptionsValidationException>(error.GetBaseException(), exactMatch: false);
        await Task.CompletedTask;
    }

    [Fact]
    public async Task The_summary_holds_only_the_organisations_own_settings()
    {
        factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo"), Role.SystemAdmin);
        var operatorClient = await factory.OperatorClientAsync();

        var response = await operatorClient.GetAsync("/api/platform/organisations/faithtech");

        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(
            ["administratorCount", "host", "name", "shortName", "slug", "status"],
            json.EnumerateObject().Select(p => p.Name).Order());
        var summary = json.Deserialize<Summary>(new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))!;
        Assert.Equal("faithtech", summary.Slug);
        Assert.Equal("Active", summary.Status);
        Assert.True(summary.AdministratorCount >= 1);
        Assert.Equal(HttpStatusCode.NotFound, (await operatorClient.GetAsync("/api/platform/organisations/no-such-org")).StatusCode);
    }

    [Fact]
    public async Task An_operator_without_a_profile_on_a_host_is_a_non_member_there()
    {
        var operatorClient = await factory.OperatorClientAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await operatorClient.GetAsync("/api/people")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await operatorClient.GetAsync("/api/admin/audit")).StatusCode);
    }
}

/// <summary>The operator's account, which holds no profile in any organisation unless a test gives it one.</summary>
public static class OperatorClients
{
    public static async Task<HttpClient> OperatorClientAsync(this CommunityApiFactory factory)
    {
        var userId = await factory.WithDbAsync(async db =>
        {
            var normalized = CommunityApiFactory.OperatorEmail.ToUpperInvariant();
            if (await db.Users.SingleOrDefaultAsync(u => u.NormalizedEmail == normalized) is { } existing)
            {
                return existing.Id;
            }

            var user = new CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = CommunityApiFactory.OperatorEmail,
                Email = CommunityApiFactory.OperatorEmail,
                NormalizedEmail = normalized,
                NormalizedUserName = normalized,
                EmailConfirmed = true,
                SecurityStamp = Guid.NewGuid().ToString(),
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return user.Id;
        });
        return factory.ClientFor(new ProfileClients.Member(userId, Guid.Empty));
    }
}
