using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Web;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Api.Tests.Identity;

/// <summary>Drives the browser side of the authorization code + PKCE flow against the test server.</summary>
public class OidcFlow(CommunityApiFactory factory, string origin = "https://localhost")
{
    public static readonly string RedirectUri = $"{CommunityApiFactory.WebAppOrigin}/auth/callback";

    public const string Password = "a-long-enough-passphrase";

    public HttpClient Browser { get; } = factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false,
        HandleCookies = true,
        BaseAddress = new Uri(origin),
    });

    public async Task<string> CreateAccountAsync(bool verified = true)
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        await factory.CreateClient().PostAsJsonAsync("/api/account/sign-up", new { name = "Signer", email, password = Password });
        if (verified)
        {
            await factory.WithDbAsync(async db =>
            {
                (await db.Users.SingleAsync(u => u.Email == email)).EmailConfirmed = true;
                return await db.SaveChangesAsync();
            });
        }

        return email;
    }

    public Task<HttpResponseMessage> SignInAsync(string email, string password = Password) =>
        Browser.PostAsJsonAsync("/api/account/sign-in", new { email, password });

    /// <summary>Calls the authorize endpoint and returns the authorization code from the redirect.</summary>
    public async Task<string> AuthorizeAsync(string codeVerifier)
    {
        var response = await Browser.GetAsync(AuthorizeUrl(Challenge(codeVerifier)));
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!;
        Assert.StartsWith(RedirectUri, location.GetLeftPart(UriPartial.Path));
        return HttpUtility.ParseQueryString(location.Query)["code"] ?? throw new InvalidOperationException(location.ToString());
    }

    public Task<HttpResponseMessage> ExchangeCodeAsync(string code, string? codeVerifier) =>
        Browser.PostAsync("/connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["client_id"] = "web",
            ["code"] = code,
            ["redirect_uri"] = RedirectUri,
            ["code_verifier"] = codeVerifier ?? string.Empty,
        }.Where(p => p.Value.Length > 0)));

    public Task<HttpResponseMessage> RefreshAsync(string refreshToken) =>
        Browser.PostAsync("/connect/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["client_id"] = "web",
            ["refresh_token"] = refreshToken,
        }));

    /// <summary>Signs in and completes the whole flow.</summary>
    public async Task<TokenResponse> SignInAndGetTokensAsync(string email)
    {
        (await SignInAsync(email)).EnsureSuccessStatusCode();
        var verifier = NewCodeVerifier();
        var response = await ExchangeCodeAsync(await AuthorizeAsync(verifier), verifier);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TokenResponse>())!;
    }

    public HttpClient Api(string accessToken)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        client.DefaultRequestHeaders.Authorization = new("Bearer", accessToken);
        return client;
    }

    public static string NewCodeVerifier() => Base64Url(RandomNumberGenerator.GetBytes(32));

    public static string AuthorizeUrl(string codeChallenge) =>
        "/connect/authorize?client_id=web&response_type=code&scope=openid%20profile%20email%20roles%20offline_access" +
        $"&redirect_uri={Uri.EscapeDataString(RedirectUri)}&code_challenge={codeChallenge}&code_challenge_method=S256&state=xyz";

    private static string Challenge(string verifier) => Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public record TokenResponse(
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("refresh_token")] string RefreshToken,
    [property: JsonPropertyName("expires_in")] int ExpiresIn);
