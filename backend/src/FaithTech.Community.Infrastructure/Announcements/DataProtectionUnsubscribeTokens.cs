using System.Globalization;
using System.Security.Cryptography;
using FaithTech.Community.Application.Announcements;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;

namespace FaithTech.Community.Infrastructure.Announcements;

/// <summary>
/// Protects "profile id + issue time" under a purpose used for nothing else, so a token can only
/// opt its own profile out, and only for a year (ADR 0016).
/// </summary>
public class DataProtectionUnsubscribeTokens(IDataProtectionProvider provider, TimeProvider time) : IUnsubscribeTokens
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(365);

    private readonly IDataProtector _protector = provider.CreateProtector("FaithTech.Community.Announcements.Unsubscribe.v1");

    public string Issue(Guid profileId)
    {
        var payload = $"{profileId:N}.{time.GetUtcNow().ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)}";
        return WebEncoders.Base64UrlEncode(_protector.Protect(System.Text.Encoding.UTF8.GetBytes(payload)));
    }

    public Guid? Verify(string token)
    {
        try
        {
            var payload = System.Text.Encoding.UTF8.GetString(_protector.Unprotect(WebEncoders.Base64UrlDecode(token)));
            var parts = payload.Split('.');
            if (parts.Length != 2
                || !Guid.TryParseExact(parts[0], "N", out var profileId)
                || !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var issued))
            {
                return null;
            }

            var age = time.GetUtcNow() - DateTimeOffset.FromUnixTimeSeconds(issued);
            return age >= TimeSpan.Zero && age <= Lifetime ? profileId : null;
        }
        catch (Exception exception) when (exception is CryptographicException or FormatException)
        {
            return null;
        }
    }
}
