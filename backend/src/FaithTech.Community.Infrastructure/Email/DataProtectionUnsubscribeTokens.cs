using System.Globalization;
using System.Security.Cryptography;
using FaithTech.Community.Application.Announcements;
using Microsoft.AspNetCore.DataProtection;

namespace FaithTech.Community.Infrastructure.Email;

/// <summary>
/// Unsubscribe tokens protected with ASP.NET Data Protection under their own purpose, so no other signed value
/// in the system is accepted as one. The payload is the profile id and the time of issue (ADR 0016).
/// </summary>
public class DataProtectionUnsubscribeTokens(IDataProtectionProvider provider, TimeProvider time) : IUnsubscribeTokens
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(365);

    private readonly IDataProtector _protector = provider.CreateProtector("FaithTech.Community.AnnouncementUnsubscribe.v1");

    public string Issue(Guid profileId) =>
        _protector.Protect($"{profileId:N}.{time.GetUtcNow().ToUnixTimeSeconds()}");

    public Guid? Read(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        string payload;
        try
        {
            payload = _protector.Unprotect(token);
        }
        catch (Exception exception) when (exception is CryptographicException or FormatException)
        {
            return null;
        }

        var parts = payload.Split('.');
        if (parts.Length != 2
            || !Guid.TryParseExact(parts[0], "N", out var profileId)
            || !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var issued))
        {
            return null;
        }

        var age = time.GetUtcNow() - DateTimeOffset.FromUnixTimeSeconds(issued);
        return age <= Lifetime ? profileId : null;
    }
}
