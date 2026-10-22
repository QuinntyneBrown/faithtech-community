using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Authentication;

/// <summary>
/// Loads the signed-in caller's roles from their profile on every request, so a role added or removed
/// takes effect at once, even on a token issued before the change (L2-009, L2-042). The role claims in
/// a token are only a hint for clients; the server never authorizes with them.
/// </summary>
public class CurrentRolesMiddleware(RequestDelegate next)
{
    public const string ItemKey = "FaithTech.CurrentRoles";

    public async Task InvokeAsync(HttpContext context, IApplicationDbContext db)
    {
        if (context.User.Identity?.IsAuthenticated == true
            && Guid.TryParse(context.User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value, out var userId))
        {
            var profileId = await db.Users.Where(u => u.Id == userId).Select(u => (Guid?)u.ProfileId).SingleOrDefaultAsync(context.RequestAborted);
            Role[] roles = profileId is null
                ? []
                : await db.Profiles.Where(p => p.Id == profileId)
                    .SelectMany(p => p.Roles.Select(r => r.Role))
                    .ToArrayAsync(context.RequestAborted);
            context.Items[ItemKey] = roles;
        }

        await next(context);
    }
}
