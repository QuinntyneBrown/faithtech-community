namespace FaithTech.Community.Application.Common;

/// <summary>A role a recipient holds, by definition id and name, for saying which shared role reached them.</summary>
public sealed record HeldShareRole(Guid Id, string Name)
{
    /// <summary>"everyone who has the {role} role, which includes you" for the first shared role the recipient holds.</summary>
    public static string Via(IEnumerable<Guid> sharedRoleIds, IReadOnlyList<HeldShareRole> held)
    {
        var name = sharedRoleIds.Select(id => held.FirstOrDefault(h => h.Id == id)).OfType<HeldShareRole>().First().Name;
        return $"everyone who has the {name} role, which includes you";
    }
}
