using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Common;

public interface ICurrentUser
{
    /// <summary>The global account (ADR 0032).</summary>
    Guid? UserId { get; }

    /// <summary>The caller's membership of the current organisation; null for a non-member or an anonymous caller.</summary>
    CurrentMembership? Membership { get; }

    /// <summary>The caller's profile in the current organisation, read from <see cref="Membership"/>.</summary>
    Guid? ProfileId => Membership?.ProfileId;

    bool IsMember => Membership is not null;

    IReadOnlyCollection<Role> Roles { get; }

    bool IsAuthenticated { get; }

    bool HasRole(Role role);
}
