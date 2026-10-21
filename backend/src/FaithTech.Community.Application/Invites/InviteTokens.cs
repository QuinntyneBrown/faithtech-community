using System.Security.Cryptography;
using System.Text;

namespace FaithTech.Community.Application.Invites;

/// <summary>Invite link secrets (ADR 0006): 32 random bytes, base64url; only the SHA-256 hash is stored.</summary>
public static class InviteTokens
{
    public static string New() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
