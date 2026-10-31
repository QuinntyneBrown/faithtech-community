using System.Security.Claims;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
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
        ICurrentOrganisation organisation,
        IOpenIddictApplicationManager applications,
        IOpenIddictAuthorizationManager authorizations)
    {
        var request = context.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        var session = await context.AuthenticateAsync(IdentityConstants.ApplicationScheme);
        var user = session.Succeeded ? await users.GetUserAsync(session.Principal) : null;
        var profile = user is null ? null : await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == user.Id);

        // An account with no profile here still gets a session, because the account is global; the app shows it the
        // not-a-member page and the API refuses it (L2-132 AC3). A suspended membership gets none.
        if (user is null || profile is { IsSuspended: true })
        {
            // No usable session: send the browser to this host's sign-in page, which comes back here.
            await context.SignOutAsync(IdentityConstants.ApplicationScheme);
            var returnUrl = context.Request.PathBase + context.Request.Path + context.Request.QueryString;
            return Results.Redirect($"{organisation.Origin}/sign-in?returnUrl={Uri.EscapeDataString(returnUrl)}");
        }

        var identity = new ClaimsIdentity(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme, Claims.Name, Claims.Role);
        identity.SetClaim(Claims.Subject, user.Id.ToString())
            .SetClaim(Claims.Email, user.Email)
            .SetClaim(Claims.EmailVerified, user.EmailConfirmed)
            .SetClaim(Claims.Name, profile?.Name ?? user.Email)
            .SetClaims(Claims.Role, [.. profile?.Roles.Select(r => r.Definition!.Key) ?? []]);
        identity.SetScopes(request.GetScopes());

        // Each session is stamped with the organisation whose host issued it, so suspending a membership revokes that
        // organisation's sessions only (L2-132 AC5). The stamp is for revocation; the host still decides the organisation.
        var application = await applications.FindByClientIdAsync(request.ClientId!)
            ?? throw new InvalidOperationException("The client application cannot be found.");
        var descriptor = new OpenIddictAuthorizationDescriptor
        {
            ApplicationId = await applications.GetIdAsync(application),
            CreationDate = DateTimeOffset.UtcNow,
            Principal = new ClaimsPrincipal(identity),
            Status = Statuses.Valid,
            Subject = user.Id.ToString(),
            Type = AuthorizationTypes.AdHoc,
        };
        descriptor.Scopes.UnionWith(request.GetScopes());
        descriptor.Properties[TokenRevocationProperties.OrganisationId] = System.Text.Json.JsonSerializer.SerializeToElement(organisation.Id);
        var authorization = await authorizations.CreateAsync(descriptor);
        identity.SetAuthorizationId(await authorizations.GetIdAsync(authorization));
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
