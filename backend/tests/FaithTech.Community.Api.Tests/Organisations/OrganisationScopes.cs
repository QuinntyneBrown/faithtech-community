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
        var organisation = scope.ServiceProvider.GetRequiredService<Infrastructure.Persistence.CommunityDbContext>().Organisations
            .AsNoTracking().SingleOrDefault(o => o.Id == organisationId);
        var current = scope.ServiceProvider.GetRequiredService<OrganisationScope>();
        // Before the database is seeded (the fixture's own set-up) there is no row yet to read the names from.
        if (organisation is null)
        {
            current.RunAs(organisationId);
        }
        else
        {
            current.Set(organisation);
        }
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
        // Its own copy of the nine role definitions, so members there can hold roles (ADR 0033).
        await factory.WithDbAsync(id, async db =>
        {
            if (!await db.RoleDefinitions.AnyAsync())
            {
                db.RoleDefinitions.AddRange(TestRoles.DefinitionsFor());
                await db.SaveChangesAsync();
            }

            // And of FaithTech's partner stages, with new ids (L2-144).
            if (!await db.PartnerStages.AnyAsync())
            {
                db.PartnerStages.AddRange(FaithTechSeed.Stages.Select((stage, index) =>
                    new PartnerStage(Guid.NewGuid(), stage.Key, stage.Name, index + 1, stage.IsInitial, stage.Kind)));
                await db.SaveChangesAsync();
            }

            // And of FaithTech's event types, with new ids (L2-145).
            if (!await db.EventTypes.AnyAsync())
            {
                db.EventTypes.AddRange(FaithTechSeed.Types.Select((type, index) =>
                    new EventType(Guid.NewGuid(), type.Key, type.Name, index + 1)));
                await db.SaveChangesAsync();
            }

            return 0;
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
                var key = role.ToString();
                profile.AddRole(await db.RoleDefinitions.SingleAsync(d => d.Key == key), Guid.Empty, DateTime.UtcNow);
            }

            var email = $"{Guid.NewGuid():N}@example.org";
            var user = new CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                NormalizedUserName = email.ToUpperInvariant(),
                EmailConfirmed = true,
                SecurityStamp = Guid.NewGuid().ToString(),
            };
            profile.LinkAccount(user.Id);
            db.Profiles.Add(profile);
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return new ProfileClients.Member(user.Id, profile.Id);
        });

    /// <summary>
    /// A second membership for an existing account: a profile in <paramref name="organisation"/> linked to
    /// <paramref name="userId"/> (ADR 0032). Slice 07 creates these by sign-up, invite and connect link; tests arrange them.
    /// </summary>
    public static Task<ProfileClients.Member> AddMembershipAsync(
        this CommunityApiFactory factory, OtherOrganisation organisation, Guid userId, string name, params Role[] roles) =>
        factory.WithDbAsync(organisation.Id, async db =>
        {
            var profile = new Profile(name);
            profile.LinkAccount(userId);
            foreach (var role in roles)
            {
                var key = role.ToString();
                profile.AddRole(await db.RoleDefinitions.SingleAsync(d => d.Key == key), Guid.Empty, DateTime.UtcNow);
            }

            db.Profiles.Add(profile);
            await db.SaveChangesAsync();
            return new ProfileClients.Member(userId, profile.Id);
        });

    /// <summary>
    /// A client on <paramref name="organisation"/>'s host, signed in as <paramref name="member"/>, whose roles were granted
    /// when the member was added there.
    /// </summary>
    public static HttpClient ClientOn(this CommunityApiFactory factory, OtherOrganisation organisation, ProfileClients.Member member)
    {
        var client = factory.ClientFor(member);
        client.BaseAddress = new Uri(organisation.Origin);
        return client;
    }
}
