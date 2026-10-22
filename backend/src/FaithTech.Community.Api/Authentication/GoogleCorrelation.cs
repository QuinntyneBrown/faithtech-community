using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace FaithTech.Community.Api.Authentication;

/// <summary>
/// The Google sign-in correlation cookie (ADR 0019): the state, the nonce and where to land, protected so the
/// browser can neither read nor forge it, kept for 10 minutes and deleted when Google sends the browser back.
/// </summary>
public class GoogleCorrelation(IDataProtectionProvider dataProtection, TimeProvider time)
{
    public const string CookieName = "ftc.google";
    public const string CookiePath = "/api/account/google";
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    private readonly ITimeLimitedDataProtector _protector =
        dataProtection.CreateProtector("FaithTech.Community.GoogleSignIn").ToTimeLimitedDataProtector();

    public record Pending(string State, string Nonce, string ReturnUrl, bool KeepSignedIn);

    public static string NewSecret() => Base64Url(RandomNumberGenerator.GetBytes(32));

    public void Write(HttpContext context, Pending pending)
    {
        var expires = time.GetUtcNow() + Lifetime;
        var value = _protector.Protect(JsonSerializer.Serialize(pending), expires);
        context.Response.Cookies.Append(CookieName, value, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            // Lax: Google's redirect back is a top-level GET, so the cookie comes with it.
            SameSite = SameSiteMode.Lax,
            Path = CookiePath,
            Expires = expires,
            IsEssential = true,
        });
    }

    /// <summary>Reads the pending sign-in and deletes the cookie, so a callback can be used once.</summary>
    public Pending? ReadAndClear(HttpContext context)
    {
        var value = context.Request.Cookies[CookieName];
        context.Response.Cookies.Delete(CookieName, new CookieOptions { Path = CookiePath, Secure = true, HttpOnly = true, SameSite = SameSiteMode.Lax });
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<Pending>(_protector.Unprotect(value, out var expiration)) is { } pending && expiration > time.GetUtcNow()
                ? pending
                : null;
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    /// <summary>Compares the state Google returned with the one sent, in constant time.</summary>
    public static bool StateMatches(Pending pending, string? state) =>
        state is not null && CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(pending.State), System.Text.Encoding.UTF8.GetBytes(state));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
