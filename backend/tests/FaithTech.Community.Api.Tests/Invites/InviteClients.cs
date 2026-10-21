using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using FaithTech.Community.Api.Tests.Profiles;
using FaithTech.Community.Domain.Invites;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Invites;

/// <summary>Invites stored directly, and the token read back out of an invite email.</summary>
public static partial class InviteClients
{
    public static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    /// <summary>Stores an invite with a known token, sent <paramref name="age"/> ago.</summary>
    public static async Task<(Invite Invite, string Token)> AddInviteAsync(
        this CommunityApiFactory factory, ProfileClients.Member inviter, string email, Role? role = null, TimeSpan age = default)
    {
        var token = Guid.NewGuid().ToString("N");
        var invite = new Invite(email, Hash(token), role, inviter.ProfileId, factory.Time.GetUtcNow() - age);
        await factory.WithDbAsync(async db =>
        {
            db.Invites.Add(invite);
            return await db.SaveChangesAsync();
        });
        return (invite, token);
    }

    public static Task<Invite> LoadInviteAsync(this CommunityApiFactory factory, Guid id) =>
        factory.WithDbAsync(db => db.Invites.AsNoTracking().SingleAsync(i => i.Id == id));

    public static Task SetEmailConfirmedAsync(this CommunityApiFactory factory, ProfileClients.Member member, bool confirmed) =>
        factory.WithDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Id == member.UserId)).EmailConfirmed = confirmed;
            return await db.SaveChangesAsync();
        });

    public static string TokenFrom(string emailBody) =>
        InviteLink().Match(emailBody) is { Success: true } match ? match.Groups[1].Value : throw new InvalidOperationException(emailBody);

    [GeneratedRegex(@"/accept-invite/([A-Za-z0-9_-]+)")]
    private static partial Regex InviteLink();
}
