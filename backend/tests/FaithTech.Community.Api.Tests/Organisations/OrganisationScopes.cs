using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Domain.Profiles;
using FaithTech.Community.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Organisations;

/// <summary>Service scopes with an organisation in scope, and a second organisation beside FaithTech (L2-130).</summary>
public static class OrganisationScopes
{
    /// <summary>A scope working in <paramref name="organisationId"/>, as a request on its host or a worker's unit of work.</summary>
    public static AsyncServiceScope CreateOrganisationScope(this IServiceProvider services, Guid organisationId)
    {
        var scope = services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<OrganisationScope>().RunAs(organisationId);
        return scope;
    }

    /// <summary>A scope working in FaithTech, the organisation every existing test works in.</summary>
    public static AsyncServiceScope CreateFaithTechScope(this IServiceProvider services) =>
        services.CreateOrganisationScope(FaithTechSeed.OrganisationId);

    public record OtherOrganisation(Guid Id, string Origin);

    /// <summary>Adds an active organisation on https://app.{slug}.test, once per fixture, and answers it.</summary>
    public static async Task<OtherOrganisation> AddOrganisationAsync(this CommunityApiFactory factory, string slug = "northside")
    {
        var host = $"app.{slug}.test";
        var id = await factory.WithDbAsync(async db =>
        {
            var existing = await db.Organisations.SingleOrDefaultAsync(o => o.Slug == slug);
            if (existing is not null)
            {
                return existing.Id;
            }

            var organisation = new Organisation(Guid.NewGuid(), slug, host, $"{slug} community", slug, DateTime.UtcNow);
            db.Organisations.Add(organisation);
            await db.SaveChangesAsync();
            return organisation.Id;
        });
        return new OtherOrganisation(id, $"https://{host}");
    }

    /// <summary>A member with an account and a profile in <paramref name="organisation"/>.</summary>
    public static Task<ProfileClients.Member> AddMemberAsync(
        this CommunityApiFactory factory, OtherOrganisation organisation, string name, params Role[] roles) =>
        factory.WithDbAsync(organisation.Id, async db =>
        {
            var profile = new Profile(name);
            foreach (var role in roles)
            {
                profile.AddRole(role, Guid.Empty, DateTime.UtcNow);
            }

            var email = $"{Guid.NewGuid():N}@example.org";
            db.Profiles.Add(profile);
            db.Users.Add(new CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                NormalizedUserName = email.ToUpperInvariant(),
                EmailConfirmed = true,
                ProfileId = profile.Id,
            });
            await db.SaveChangesAsync();
            return new ProfileClients.Member(db.Users.Local.Single(u => u.ProfileId == profile.Id).Id, profile.Id);
        });

    /// <summary>A client on <paramref name="organisation"/>'s host, signed in as <paramref name="member"/>.</summary>
    public static HttpClient ClientOn(this CommunityApiFactory factory, OtherOrganisation organisation, ProfileClients.Member member, params Role[] roles)
    {
        var client = factory.ClientFor(member, roles);
        client.BaseAddress = new Uri(organisation.Origin);
        return client;
    }
}
