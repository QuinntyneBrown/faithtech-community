using FaithTech.Community.Application.Identity;
using FaithTech.Community.Domain.Profiles;
using Microsoft.AspNetCore.Authentication;
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

    /// <summary>A client authenticated as the member, carrying the given roles in its token.</summary>
    public static HttpClient ClientFor(this CommunityApiFactory factory, Member member, params Role[] roles)
    {
        var client = factory.WithWebHostBuilder(b => b.ConfigureServices(s => s
            .AddAuthentication(TestAuthHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null))).CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, $"{member.UserId};{string.Join(',', roles)}");
        return client;
    }
}
