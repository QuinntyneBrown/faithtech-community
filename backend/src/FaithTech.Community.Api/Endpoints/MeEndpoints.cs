using System.Security.Claims;
using FaithTech.Community.Application.Common;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Endpoints;

public static class MeEndpoints
{
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/me", (ICurrentUser user, ClaimsPrincipal principal) => Results.Ok(new
        {
            Id = user.UserId,
            Name = principal.FindFirst(OpenIddictConstants.Claims.Name)?.Value,
            Email = principal.FindFirst(OpenIddictConstants.Claims.Email)?.Value,
            EmailVerified = principal.FindFirst(OpenIddictConstants.Claims.EmailVerified)?.Value == "true",
            Roles = user.Roles.Select(r => r.ToString()),
        }));
        return app;
    }
}
