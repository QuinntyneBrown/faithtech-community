using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Authentication;

public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value, out var id) ? id : null;

    public IReadOnlyCollection<Role> Roles =>
        accessor.HttpContext?.User.FindAll(OpenIddictConstants.Claims.Role)
            .Select(c => Enum.TryParse<Role>(c.Value, out var role) ? role : (Role?)null)
            .OfType<Role>()
            .ToArray() ?? [];

    public bool IsAuthenticated => accessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public bool HasRole(Role role) => Roles.Contains(role);
}
