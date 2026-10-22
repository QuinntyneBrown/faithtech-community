using System.Net.Http.Json;
using System.Text.Json.Serialization;
using FaithTech.Community.Application.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace FaithTech.Community.Infrastructure.Identity;

/// <summary>Google OAuth client settings, from configuration or environment variables; never in the repository.</summary>
public class GoogleOptions
{
    public const string Section = "Google";

    public string ClientId { get; set; } = string.Empty;

    public string ClientSecret { get; set; } = string.Empty;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}

/// <summary>Google's authorization code flow with OpenID Connect (ADR 0019).</summary>
public class GoogleIdentityProvider(
    HttpClient http,
    GoogleIdTokenValidator validator,
    IOptions<GoogleOptions> options,
    ILogger<GoogleIdentityProvider> logger) : IGoogleIdentityProvider
{
    public const string AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    public const string TokenEndpoint = "https://oauth2.googleapis.com/token";

    public string? BuildAuthorizationUrl(string state, string nonce, string redirectUri)
    {
        if (!options.Value.IsConfigured)
        {
            return null;
        }

        var query = new Dictionary<string, string>
        {
            ["response_type"] = "code",
            ["client_id"] = options.Value.ClientId,
            ["redirect_uri"] = redirectUri,
            ["scope"] = "openid email profile",
            ["state"] = state,
            ["nonce"] = nonce,
            ["prompt"] = "select_account",
        };
        return $"{AuthorizationEndpoint}?{string.Join('&', query.Select(p => $"{p.Key}={Uri.EscapeDataString(p.Value)}"))}";
    }

    public async Task<GoogleIdentity?> ExchangeCodeAsync(string code, string redirectUri, string nonce, CancellationToken cancellationToken = default)
    {
        if (!options.Value.IsConfigured)
        {
            return null;
        }

        try
        {
            using var response = await http.PostAsync(TokenEndpoint, new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["client_id"] = options.Value.ClientId,
                ["client_secret"] = options.Value.ClientSecret,
                ["redirect_uri"] = redirectUri,
            }), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Google refused the authorization code with {Status}", (int)response.StatusCode);
                return null;
            }

            var tokens = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken);
            return tokens?.IdToken is { } idToken ? await validator.ValidateAsync(idToken, nonce, cancellationToken) : null;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning(exception, "Google's token endpoint is unavailable");
            return null;
        }
    }

    private sealed record TokenResponse([property: JsonPropertyName("id_token")] string? IdToken);
}

/// <summary>
/// Validates a Google ID token: Google's signature, issuer, this client as audience, expiry by the application
/// clock and the nonce sent with this sign-in. Anything else gives null.
/// </summary>
public class GoogleIdTokenValidator(
    IConfigurationManager<OpenIdConnectConfiguration> googleConfiguration,
    IOptions<GoogleOptions> options,
    TimeProvider time)
{
    public const string DiscoveryDocument = "https://accounts.google.com/.well-known/openid-configuration";
    private static readonly string[] Issuers = ["https://accounts.google.com", "accounts.google.com"];
    private static readonly TimeSpan Skew = TimeSpan.FromMinutes(5);

    public async Task<GoogleIdentity?> ValidateAsync(string idToken, string nonce, CancellationToken cancellationToken = default)
    {
        var configuration = await googleConfiguration.GetConfigurationAsync(cancellationToken);
        var now = time.GetUtcNow().UtcDateTime;
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(idToken, new TokenValidationParameters
        {
            ValidIssuers = Issuers,
            ValidAudience = options.Value.ClientId,
            IssuerSigningKeys = configuration.SigningKeys,
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            // Judged by the application clock (TimeProvider), not the system clock the handler would read.
            LifetimeValidator = (notBefore, expires, _, _) =>
                expires is { } exp && exp > now - Skew && (notBefore is not { } nbf || nbf <= now + Skew),
        });
        if (!result.IsValid || result.SecurityToken is not JsonWebToken token)
        {
            return null;
        }

        if (!token.TryGetPayloadValue<string>("nonce", out var tokenNonce) || tokenNonce != nonce
            || !token.TryGetPayloadValue<string>("email", out var email) || string.IsNullOrWhiteSpace(email)
            || string.IsNullOrWhiteSpace(token.Subject))
        {
            return null;
        }

        token.TryGetPayloadValue<bool>("email_verified", out var emailVerified);
        token.TryGetPayloadValue<string>("name", out var name);
        return new GoogleIdentity(token.Subject, email, emailVerified, name);
    }
}
