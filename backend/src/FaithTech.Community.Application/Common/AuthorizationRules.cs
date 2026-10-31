using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Common;

/// <summary>The rules every access class shares (ADR 0033, L2-135).</summary>
public static class AuthorizationRules
{
    /// <summary>
    /// Whether <paramref name="actor"/> may act only because they hold AdministerOrganisation: they lack
    /// <paramref name="capability"/> itself. Every override is audited (L2-135 AC5).
    /// </summary>
    public static bool IsOverride(ICurrentUser actor, string capability) =>
        actor.Capabilities.Contains(Capability.AdministerOrganisation) && !actor.Capabilities.Contains(capability);
}
