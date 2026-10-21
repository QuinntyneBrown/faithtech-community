using System.Security.Claims;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Endpoints;

public static class MeEndpoints
{
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        // Name, email and verification come from the database so they stay current for the token's lifetime.
        app.MapGet("/api/me", async (ICurrentUser current, ClaimsPrincipal principal, UserManager<CommunityUser> users, IApplicationDbContext db) =>
        {
            var user = current.UserId is { } id ? await users.FindByIdAsync(id.ToString()) : null;
            var name = user is null
                ? principal.FindFirst(OpenIddictConstants.Claims.Name)?.Value
                : await db.Profiles.Where(p => p.Id == user.ProfileId).Select(p => p.Name).SingleOrDefaultAsync();

            return Results.Ok(new
            {
                Id = current.UserId,
                // The top-bar avatar's colour comes from the profile id, as on every other screen (ADR 0008).
                ProfileId = user?.ProfileId,
                Name = name,
                Email = user?.Email ?? principal.FindFirst(OpenIddictConstants.Claims.Email)?.Value,
                EmailVerified = user?.EmailConfirmed ?? false,
                Roles = current.Roles.Select(r => r.ToString()),
            });
        });
        return app;
    }
}
