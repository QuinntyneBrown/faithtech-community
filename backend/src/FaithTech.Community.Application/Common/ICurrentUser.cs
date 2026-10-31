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

    /// <summary>
    /// Temporary adapter, removed in slice 11: the held roles as former <see cref="Role"/> values, read from the held
    /// definitions' keys (<see cref="LegacyRoles"/>).
    /// </summary>
    IReadOnlyCollection<Role> Roles { get; }

    /// <summary>The union of the capabilities of the caller's non-archived roles here, computed on this request.</summary>
    IReadOnlySet<string> Capabilities => Membership?.Capabilities ?? new HashSet<string>();

    bool IsAuthenticated { get; }

    /// <summary>Temporary adapter, removed in slice 11: whether a held definition's key is the former value.</summary>
    bool HasRole(Role role);

    /// <summary>Whether the caller holds <paramref name="capability"/>; a holder of AdministerOrganisation holds every one (L2-135 AC3).</summary>
    bool Has(string capability) =>
        Capabilities.Contains(capability) || Capabilities.Contains(Domain.Organisations.Capability.AdministerOrganisation);
}
