// Traces to: L2-078 AC6
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using FaithTech.Community.Infrastructure.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace FaithTech.Community.Infrastructure.Tests.Identity;

public class GoogleIdTokenValidatorTests
{
    private const string ClientId = "client-id.apps.googleusercontent.test";
    private const string Nonce = "nonce-sent-to-google";
    private static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);

    private readonly RsaSecurityKey _googleKey = new(RSA.Create(2048)) { KeyId = "google-key" };
    private readonly FakeTimeProvider _time = new(Now);

    [Fact]
    public async Task A_token_signed_by_Google_for_this_client_and_nonce_gives_the_identity()
    {
        var identity = await Validator().ValidateAsync(Token(), Nonce);

        Assert.NotNull(identity);
        Assert.Equal(("google-subject", "leah@gmail.test", true, "Leah Thompson"), (identity.Subject, identity.Email, identity.EmailVerified, identity.Name));
    }

    [Fact]
    public async Task Both_of_Googles_issuer_spellings_are_accepted()
    {
        Assert.NotNull(await Validator().ValidateAsync(Token(issuer: "accounts.google.com"), Nonce));
    }

    [Fact]
    public async Task An_unverified_email_is_reported_as_unverified()
    {
        var identity = await Validator().ValidateAsync(Token(emailVerified: false), Nonce);

        Assert.False(identity!.EmailVerified);
    }

    [Theory]
    [InlineData("issuer")]
    [InlineData("audience")]
    [InlineData("expired")]
    [InlineData("nonce")]
    [InlineData("signature")]
    [InlineData("no-email")]
    public async Task A_token_that_fails_any_check_is_refused(string broken)
    {
        var token = broken switch
        {
            "issuer" => Token(issuer: "https://evil.example"),
            "audience" => Token(audience: "someone-else.apps.googleusercontent.test"),
            "expired" => Token(expires: Now.AddMinutes(-6)),
            "nonce" => Token(nonce: "another-sign-in"),
            "signature" => Token(key: new RsaSecurityKey(RSA.Create(2048)) { KeyId = "google-key" }),
            _ => Token(email: null),
        };

        Assert.Null(await Validator().ValidateAsync(token, Nonce));
    }

    [Fact]
    public async Task Expiry_is_judged_by_the_application_clock_with_five_minutes_of_skew()
    {
        var token = Token(expires: Now.AddMinutes(-4));

        Assert.NotNull(await Validator().ValidateAsync(token, Nonce));
    }

    [Fact]
    public void Without_a_client_id_and_secret_there_is_no_authorization_url()
    {
        var provider = Provider(new GoogleOptions(), new StubHandler(_ => throw new InvalidOperationException()));

        Assert.Null(provider.BuildAuthorizationUrl("state", "nonce", "https://app.faithtech.test/api/account/google/callback"));
    }

    [Fact]
    public void The_authorization_url_asks_Google_for_a_code_with_the_state_and_nonce()
    {
        var url = new Uri(Provider(Options(), new StubHandler(_ => throw new InvalidOperationException()))
            .BuildAuthorizationUrl("the-state", "the-nonce", "https://app.faithtech.test/api/account/google/callback")!);
        var query = System.Web.HttpUtility.ParseQueryString(url.Query);

        Assert.Equal("https://accounts.google.com/o/oauth2/v2/auth", url.GetLeftPart(UriPartial.Path));
        Assert.Equal(("code", ClientId, "openid email profile", "the-state", "the-nonce"),
            (query["response_type"], query["client_id"], query["scope"], query["state"], query["nonce"]));
        Assert.Equal("https://app.faithtech.test/api/account/google/callback", query["redirect_uri"]);
    }

    [Fact]
    public async Task The_code_is_exchanged_with_the_client_secret_and_the_ID_token_validated()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(new { id_token = Token(), access_token = "a", token_type = "Bearer" })),
        });

        var identity = await Provider(Options(), handler).ExchangeCodeAsync("the-code", "https://app.faithtech.test/api/account/google/callback", Nonce);

        Assert.Equal("leah@gmail.test", identity!.Email);
        Assert.Equal("https://oauth2.googleapis.com/token", handler.LastRequest!.RequestUri!.ToString());
        var form = System.Web.HttpUtility.ParseQueryString(handler.LastBody!);
        Assert.Equal(("authorization_code", "the-code", ClientId, "the-secret"),
            (form["grant_type"], form["code"], form["client_id"], form["client_secret"]));
    }

    [Fact]
    public async Task A_code_Google_refuses_gives_no_identity()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("""{"error":"invalid_grant"}"""),
        });

        Assert.Null(await Provider(Options(), handler).ExchangeCodeAsync("used-code", "https://app.faithtech.test/cb", Nonce));
    }

    private static GoogleOptions Options() => new() { ClientId = ClientId, ClientSecret = "the-secret" };

    private GoogleIdTokenValidator Validator()
    {
        var configuration = new OpenIdConnectConfiguration();
        configuration.SigningKeys.Add(_googleKey);
        return new GoogleIdTokenValidator(
            new StaticConfigurationManager<OpenIdConnectConfiguration>(configuration),
            Microsoft.Extensions.Options.Options.Create(Options()),
            _time);
    }

    private GoogleIdentityProvider Provider(GoogleOptions options, StubHandler handler) =>
        new(new HttpClient(handler), Validator(), Microsoft.Extensions.Options.Options.Create(options), NullLogger<GoogleIdentityProvider>.Instance);

    private string Token(
        string issuer = "https://accounts.google.com",
        string audience = ClientId,
        DateTimeOffset? expires = null,
        string nonce = Nonce,
        bool emailVerified = true,
        string? email = "leah@gmail.test",
        RsaSecurityKey? key = null)
    {
        var claims = new Dictionary<string, object>
        {
            ["sub"] = "google-subject",
            ["email_verified"] = emailVerified,
            ["name"] = "Leah Thompson",
            ["nonce"] = nonce,
        };
        if (email is not null)
        {
            claims["email"] = email;
        }

        var expiry = expires ?? Now.AddMinutes(55);
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            IssuedAt = expiry.AddHours(-1).UtcDateTime,
            NotBefore = expiry.AddHours(-1).UtcDateTime,
            Expires = expiry.UtcDateTime,
            Claims = claims,
            SigningCredentials = new SigningCredentials(key ?? _googleKey, SecurityAlgorithms.RsaSha256),
        });
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        public string? LastBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            LastBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return respond(request);
        }
    }
}
