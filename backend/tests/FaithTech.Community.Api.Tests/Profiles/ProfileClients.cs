using System.Runtime.CompilerServices;
using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FaithTech.Community.Api.Tests.Profiles;

/// <summary>Members with real accounts and profiles, and clients signed in as them.</summary>
public static class ProfileClients
{
    public record Member(Guid UserId, Guid ProfileId);

    public static async Task<Member> AddMemberAsync(
        this CommunityApiFactory factory, string name, Action<Profile>? shape = null)
    {
        return await factory.WithDbAsync(async db =>
        {
            var profile = new Profile(name);
            shape?.Invoke(profile);
            var email = $"{Guid.NewGuid():N}@example.org";
            var user = new CommunityUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                NormalizedUserName = email.ToUpperInvariant(),
                EmailConfirmed = true,
                ProfileId = profile.Id,
            };
            db.Profiles.Add(profile);
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return new Member(user.Id, profile.Id);
        });
    }

    // One test-auth server per fixture: building a server per client made every test pay for a host start.
    private static readonly ConditionalWeakTable<CommunityApiFactory, WebApplicationFactory<Program>> TestAuthServers = new();

    /// <summary>
    /// A client authenticated as the member, who holds the given roles: they are granted on the profile,
    /// because the server authorizes with the profile's current roles, not the token's.
    /// </summary>
    public static HttpClient ClientFor(this CommunityApiFactory factory, Member member, params Role[] roles)
    {
        if (roles.Length > 0)
        {
            // The in-memory provider completes synchronously, so this cannot deadlock.
            factory.WithDbAsync(async db =>
            {
                var profile = await db.Profiles.SingleAsync(p => p.Id == member.ProfileId);
                foreach (var role in roles.Where(r => !profile.HasRole(r)))
                {
                    profile.AddRole(role, Guid.Empty, DateTime.UtcNow);
                }

                return await db.SaveChangesAsync();
            }).GetAwaiter().GetResult();
        }

        var server = TestAuthServers.GetValue(factory, f => f.WithWebHostBuilder(b => b.ConfigureServices(s => s
            .AddAuthentication(TestAuthHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null))));
        var client = server.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, $"{member.UserId};{string.Join(',', roles)}");
        return client;
    }
}
