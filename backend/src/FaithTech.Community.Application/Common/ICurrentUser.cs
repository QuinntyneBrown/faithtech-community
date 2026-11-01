using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;

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

    /// <summary>The caller's held, non-archived role assignments here (ADR 0033). Decide with <see cref="Has"/>, never a name.</summary>
    IReadOnlyList<HeldRole> Roles => Membership?.Roles ?? [];

    /// <summary>The union of the capabilities of the caller's non-archived roles here, computed on this request.</summary>
    IReadOnlySet<string> Capabilities => Membership?.Capabilities ?? new HashSet<string>();

    /// <summary>The ids of the non-archived role definitions the caller holds here (ADR 0033).</summary>
    IReadOnlyList<Guid> HeldRoleIds => [.. Membership?.Roles.Select(r => r.Id) ?? []];

    bool IsAuthenticated { get; }

    /// <summary>
    /// The signed-in account's email when it is listed in <c>Platform:Operators</c> and the request is for the operator
    /// API; null otherwise (L2-148 AC1). Never a role in any organisation.
    /// </summary>
    string? OperatorEmail => null;

    bool IsPlatformOperator => OperatorEmail is not null;

    /// <summary>Whether the caller holds <paramref name="capability"/>; a holder of AdministerOrganisation holds every one (L2-135 AC3).</summary>
    bool Has(string capability) =>
        Capabilities.Contains(capability) || Capabilities.Contains(Domain.Organisations.Capability.AdministerOrganisation);
}
