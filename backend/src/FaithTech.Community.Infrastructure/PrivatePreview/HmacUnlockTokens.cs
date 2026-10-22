using System.Buffers.Text;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using FaithTech.Community.Application.PrivatePreview;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Infrastructure.PrivatePreview;

/// <summary>
/// <c>w1.&lt;expiry, unix seconds&gt;.&lt;HMAC-SHA256&gt;</c>, keyed by <c>PrivatePreview:SigningKey</c>. The server checks the
/// expiry itself, and replacing the key invalidates every token (L2-089, L2-090).
/// </summary>
public class HmacUnlockTokens(IOptions<PrivatePreviewOptions> options, TimeProvider time) : IUnlockTokens
{
    private const string Version = "w1";

    private readonly byte[] _key = Convert.FromBase64String(options.Value.SigningKey);

    public string Issue(DateTimeOffset expiresAt)
    {
        var payload = $"{Version}.{expiresAt.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)}";
        return $"{payload}.{Base64Url.EncodeToString(Sign(payload))}";
    }

    public bool IsValid(string? token)
    {
        var parts = token?.Split('.') ?? [];
        if (parts.Length != 3 || parts[0] != Version
            || !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var expiresAt)
            || !Base64Url.IsValid(parts[2]))
        {
            return false;
        }

        var signatureMatches = CryptographicOperations.FixedTimeEquals(Base64Url.DecodeFromChars(parts[2]), Sign($"{parts[0]}.{parts[1]}"));
        return signatureMatches && time.GetUtcNow().ToUnixTimeSeconds() < expiresAt;
    }

    private byte[] Sign(string payload) => HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes(payload));
}
