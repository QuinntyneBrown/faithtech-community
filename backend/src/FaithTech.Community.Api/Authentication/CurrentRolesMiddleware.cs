using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Authentication;

/// <summary>
/// Loads the signed-in caller's membership of the current organisation on every request: the profile their account
/// holds there, found through the organisation-filtered context, and its roles, so a role added or removed takes effect
/// at once, even on a token issued before the change (L2-009, L2-042). A suspended profile counts as no membership
/// (L2-132). The role claims in a token are only a hint for clients; the server never authorizes with them.
/// </summary>
public class CurrentRolesMiddleware(RequestDelegate next)
{
    public const string ItemKey = "FaithTech.CurrentMembership";

    public async Task InvokeAsync(HttpContext context, IApplicationDbContext db)
    {
        if (context.User.Identity?.IsAuthenticated == true
            && Guid.TryParse(context.User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value, out var userId))
        {
            var profile = await db.Profiles.AsNoTracking()
                .Where(p => p.UserId == userId && !p.IsSuspended)
                .Select(p => new { p.Id, Roles = p.Roles.Select(r => r.Role).ToArray() })
                .SingleOrDefaultAsync(context.RequestAborted);
            if (profile is not null)
            {
                context.Items[ItemKey] = new CurrentMembership(profile.Id, profile.Roles);
            }
        }

        await next(context);
    }
}
