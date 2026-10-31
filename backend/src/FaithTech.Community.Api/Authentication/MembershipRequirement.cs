using FaithTech.Community.Application.Common;
using Microsoft.AspNetCore.Authorization;

namespace FaithTech.Community.Api.Authentication;

/// <summary>
/// Part of the fallback policy: a signed-in caller must hold a membership of the host's organisation (L2-132 AC3). An
/// account is global, so it may sign in on any host; without a profile there it reaches only what it needs to find
/// out why and to leave: GET /api/me, the account endpoints, /connect, /api/site and the platform operators' API; and to
/// join by a lead's connect link (POST /api/connect, L2-132 AC2). Anonymous endpoints opt out of the fallback policy and
/// are unaffected.
/// </summary>
public sealed class MembershipRequirement : IAuthorizationRequirement
{
    private static readonly string[] OpenToNonMembers = ["/api/account", "/connect", "/api/site", "/api/platform"];

    public static bool IsOpenToNonMembers(HttpRequest request) =>
        (HttpMethods.IsGet(request.Method) && request.Path.Equals("/api/me", StringComparison.OrdinalIgnoreCase))
        || (HttpMethods.IsPost(request.Method) && request.Path.Equals("/api/connect", StringComparison.OrdinalIgnoreCase))
        || OpenToNonMembers.Any(path => request.Path.StartsWithSegments(path, StringComparison.OrdinalIgnoreCase));
}

public sealed class MembershipHandler(ICurrentUser current, IHttpContextAccessor accessor) : AuthorizationHandler<MembershipRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, MembershipRequirement requirement)
    {
        var request = (context.Resource as HttpContext ?? accessor.HttpContext)?.Request;
        if (current.IsMember || (request is not null && MembershipRequirement.IsOpenToNonMembers(request)))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
