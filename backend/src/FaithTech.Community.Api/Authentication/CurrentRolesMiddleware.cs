using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Organisations.Platform;
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

    /// <summary>The operator's email, on an operator API request from an account in Platform:Operators (L2-148 AC1).</summary>
    public const string OperatorKey = "FaithTech.PlatformOperator";

    public async Task InvokeAsync(
        HttpContext context, IApplicationDbContext db, ProfileCapabilities capabilitiesOf, IPlatformOperators operators)
    {
        if (context.User.Identity?.IsAuthenticated == true
            && Guid.TryParse(context.User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value, out var userId))
        {
            if (context.Request.Path.StartsWithSegments("/api/platform"))
            {
                var email = await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.Email).SingleOrDefaultAsync(context.RequestAborted);
                if (operators.IsOperator(email))
                {
                    context.Items[OperatorKey] = email;
                }
            }

            var profileId = await db.Profiles.AsNoTracking()
                .Where(p => p.UserId == userId && !p.IsSuspended)
                .Select(p => (Guid?)p.Id)
                .SingleOrDefaultAsync(context.RequestAborted);
            if (profileId is { } id)
            {
                var (roles, capabilities) = await capabilitiesOf.OfAsync(id, context.RequestAborted);
                context.Items[ItemKey] = new CurrentMembership(id, roles, capabilities);
            }
        }

        await next(context);
    }
}
