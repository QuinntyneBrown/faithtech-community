using System.Collections.Concurrent;
using System.Web;
using FaithTech.Community.Application.Identity;

namespace FaithTech.Community.Api.Tests.Fakes;

/// <summary>
/// Plays Google: it builds an authorization URL that carries the state and nonce, and exchanges a code it
/// issued for the identity it was issued with, once, and only for the nonce Google was given.
/// </summary>
public class FakeGoogleIdentityProvider : IGoogleIdentityProvider
{
    public const string AuthorizationEndpoint = "https://accounts.google.test/o/oauth2/v2/auth";

    private readonly ConcurrentDictionary<string, (GoogleIdentity Identity, string Nonce)> _codes = new();

    /// <summary>False plays an API with no Google:ClientId or Google:ClientSecret.</summary>
    public bool Configured { get; set; } = true;

    public string? BuildAuthorizationUrl(string state, string nonce, string redirectUri) => Configured
        ? $"{AuthorizationEndpoint}?state={Uri.EscapeDataString(state)}&nonce={Uri.EscapeDataString(nonce)}&redirect_uri={Uri.EscapeDataString(redirectUri)}"
        : null;

    /// <summary>What Google hands back after consent: a code for this identity, bound to the nonce it was sent.</summary>
    public string IssueCode(GoogleIdentity identity, string nonce)
    {
        var code = Guid.NewGuid().ToString("N");
        _codes[code] = (identity, nonce);
        return code;
    }

    public Task<GoogleIdentity?> ExchangeCodeAsync(string code, string redirectUri, string nonce, CancellationToken cancellationToken = default) =>
        Task.FromResult(_codes.TryRemove(code, out var issued) && issued.Nonce == nonce ? issued.Identity : null);

    public static (string State, string Nonce) ReadAuthorizationUrl(Uri location)
    {
        var query = HttpUtility.ParseQueryString(location.Query);
        return (query["state"]!, query["nonce"]!);
    }
}
