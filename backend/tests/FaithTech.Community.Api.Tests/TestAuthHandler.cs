using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Api.Tests;

/// <summary>Authenticates a request as the user named in the X-Test-User header (format: id;role,role).</summary>
public class TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";
    public const string Header = "X-Test-User";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var value = Request.Headers[Header].ToString();
        if (value.Length == 0)
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var parts = value.Split(';');
        var claims = new List<Claim> { new("sub", parts[0]) };
        if (parts.Length > 1)
        {
            claims.AddRange(parts[1].Split(',', StringSplitOptions.RemoveEmptyEntries).Select(r => new Claim("role", r)));
        }

        var identity = new ClaimsIdentity(claims, SchemeName, "sub", "role");
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}
