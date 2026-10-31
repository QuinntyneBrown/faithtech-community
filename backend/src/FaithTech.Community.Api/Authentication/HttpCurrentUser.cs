using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Profiles;
using OpenIddict.Abstractions;

namespace FaithTech.Community.Api.Authentication;

public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value, out var id) ? id : null;

    /// <summary>The caller's membership of this host's organisation, read by <see cref="CurrentRolesMiddleware"/>.</summary>
    public CurrentMembership? Membership => accessor.HttpContext?.Items[CurrentRolesMiddleware.ItemKey] as CurrentMembership;

    public Guid? ProfileId => Membership?.ProfileId;

    public bool IsMember => Membership is not null;

    /// <summary>The caller's current roles in this organisation, read from their profile; never the token's role claims.</summary>
    public IReadOnlyCollection<Role> Roles => LegacyRoles.Parse(Membership?.Roles.Select(r => r.Key) ?? []);

    public bool IsAuthenticated => accessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public bool HasRole(Role role) => Roles.Contains(role);
}
