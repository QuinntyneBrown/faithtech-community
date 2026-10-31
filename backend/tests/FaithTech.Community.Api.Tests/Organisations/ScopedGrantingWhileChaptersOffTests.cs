// Traces to: L2-143 AC6, L2-140 AC6
using System.Net;
using System.Net.Http.Json;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Organisations;

/// <summary>With chapters off a tagged grantor is not scoped, and a new grant carries no tag; its own fixture, as it turns chapters off.</summary>
public class ScopedGrantingWhileChaptersOffTests : IAsyncLifetime
{
    private readonly CommunityApiFactory factory = new();

    public Task InitializeAsync() => factory.InitializeAsync();

    public Task DisposeAsync() => factory.DisposeAsync();

    public record Me(Guid[]? GrantChapterIds);

    [Fact]
    public async Task A_tagged_grantor_grants_untagged_roles_while_chapters_are_off()
    {
        var toronto = (await factory.AddChapterAsync("Toronto")).Id;
        var cityLead = factory.RoleIdOf("CityLead");
        var grace = factory.ClientFor(await factory.AddMemberAsync("Grace Okonkwo", p => p.AddRole(cityLead, Guid.Empty, DateTime.UtcNow, toronto)));
        var ruth = await factory.AddMemberAsync("Ruth Alvarez");
        await factory.WithDbAsync(async db =>
        {
            db.Organisations.Single(o => o.Id == FaithTechSeed.OrganisationId).SetChapterLabel(null, null);
            return await db.SaveChangesAsync();
        });

        var response = await grace.PostAsJsonAsync($"/api/profiles/{ruth.ProfileId}/roles", new { RoleId = factory.RoleIdOf("Volunteer") });
        var me = await grace.GetFromJsonAsync<Me>("/api/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(await factory.WithDbAsync(db => db.Profiles.Where(p => p.Id == ruth.ProfileId).SelectMany(p => p.Roles).Select(r => r.ChapterId).SingleAsync()));
        Assert.Null(me!.GrantChapterIds);
    }
}
