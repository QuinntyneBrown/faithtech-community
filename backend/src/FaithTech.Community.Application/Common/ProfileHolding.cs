using System.Linq.Expressions;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Common;

/// <summary>Database filters over the capabilities a profile's held, non-archived definitions carry (ADR 0033).</summary>
public static class ProfileHolding
{
    /// <summary>Profiles holding a definition that carries <paramref name="capability"/> itself.</summary>
    public static Expression<Func<Profile, bool>> Capability(string capability) =>
        p => p.Roles.Any(r => r.Definition!.ArchivedAtUtc == null && r.Definition.Capabilities.Contains(capability));
}
