using FaithTech.Community.Application.Admin;

namespace FaithTech.Community.Application.Common;

/// <summary>A role a recipient holds, by definition id and key, for saying which shared role reached them.</summary>
public sealed record HeldShareRole(Guid Id, string Key)
{
    /// <summary>"everyone who has the {role} role, which includes you" for the first shared role the recipient holds.</summary>
    public static string Via(IEnumerable<Guid> sharedRoleIds, IReadOnlyList<HeldShareRole> held)
    {
        var key = sharedRoleIds.Select(id => held.FirstOrDefault(h => h.Id == id)).OfType<HeldShareRole>().First().Key;
        var label = LegacyRoles.Parse([key]) is [var role] ? RoleLabels.Of(role) : key;
        return $"everyone who has the {label} role, which includes you";
    }
}
