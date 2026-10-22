using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Authentication;

public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value, out var id) ? id : null;

    /// <summary>The caller's current roles, read from their profile by <see cref="CurrentRolesMiddleware"/>; never the token's role claims.</summary>
    public IReadOnlyCollection<Role> Roles =>
        accessor.HttpContext?.Items[CurrentRolesMiddleware.ItemKey] as Role[] ?? [];

    public bool IsAuthenticated => accessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public bool HasRole(Role role) => Roles.Contains(role);
}
