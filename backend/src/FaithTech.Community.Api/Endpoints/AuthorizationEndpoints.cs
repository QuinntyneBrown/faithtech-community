using System.Security.Claims;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace FaithTech.Community.Api.Endpoints;

/// <summary>Passthrough endpoints for the OpenIddict server. Token and revocation are handled by OpenIddict itself.</summary>
public static class AuthorizationEndpoints
{
    public static IEndpointRouteBuilder MapAuthorizationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapMethods("/connect/authorize", [HttpMethods.Get, HttpMethods.Post], AuthorizeAsync).AllowAnonymous();
        app.MapMethods("/connect/logout", [HttpMethods.Get, HttpMethods.Post], (Func<HttpContext, Task<IResult>>)LogoutAsync).AllowAnonymous();
        return app;
    }

    private static async Task<IResult> AuthorizeAsync(
        HttpContext context,
        UserManager<CommunityUser> users,
        IApplicationDbContext db,
        IOptions<WebAppOptions> webApp)
    {
        var request = context.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        var session = await context.AuthenticateAsync(IdentityConstants.ApplicationScheme);
        var user = session.Succeeded ? await users.GetUserAsync(session.Principal) : null;
        var profile = user is null ? null : await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == user.Id);

        if (user is null || profile is null || profile.IsSuspended)
        {
            // No usable session: send the browser to the web app's sign-in page, which comes back here.
            await context.SignOutAsync(IdentityConstants.ApplicationScheme);
            var returnUrl = context.Request.PathBase + context.Request.Path + context.Request.QueryString;
            return Results.Redirect($"{webApp.Value.Origin}/sign-in?returnUrl={Uri.EscapeDataString(returnUrl)}");
        }

        var identity = new ClaimsIdentity(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme, Claims.Name, Claims.Role);
        identity.SetClaim(Claims.Subject, user.Id.ToString())
            .SetClaim(Claims.Email, user.Email)
            .SetClaim(Claims.EmailVerified, user.EmailConfirmed)
            .SetClaim(Claims.Name, profile.Name)
            .SetClaims(Claims.Role, [.. profile.Roles.Select(r => r.Role.ToString())]);
        identity.SetScopes(request.GetScopes());
        identity.SetDestinations(_ => [Destinations.AccessToken, Destinations.IdentityToken]);

        return Results.SignIn(new ClaimsPrincipal(identity), authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    private static async Task<IResult> LogoutAsync(HttpContext context)
    {
        await context.SignOutAsync(IdentityConstants.ApplicationScheme);
        return Results.SignOut(
            new AuthenticationProperties { RedirectUri = "/" },
            [OpenIddictServerAspNetCoreDefaults.AuthenticationScheme]);
    }
}
