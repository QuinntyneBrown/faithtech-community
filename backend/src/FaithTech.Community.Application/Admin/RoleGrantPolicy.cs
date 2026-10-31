using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Admin;

/// <summary>
/// Who may add and remove which role, from the organisation's grant rules (ADR 0033, L2-137, L2-138). A holder of
/// AdministerOrganisation may change any role that is not archived; a holder of AssignRoles the roles a grant rule of
/// one of their non-archived roles that carries AssignRoles allows, never one carrying AdministerOrganisation. The web
/// app offers exactly these (grantableRoleIds) and the API refuses the rest.
/// </summary>
public class RoleGrantPolicy(IApplicationDbContext db, ICurrentUser current)
{
    public bool CanChangeRoles => current.Has(Capability.AssignRoles);

    /// <summary>The definition ids the caller may add and remove, as /api/me answers them (L2-137 AC5).</summary>
    public async Task<IReadOnlySet<Guid>> GrantableAsync(CancellationToken cancellationToken = default) =>
        Grantable(current.Capabilities, [.. current.HeldRoleIds], await DefinitionsAsync(cancellationToken));

    public async Task<bool> CanGrantAsync(RoleDefinition definition, CancellationToken cancellationToken = default) =>
        (await GrantableAsync(cancellationToken)).Contains(definition.Id);

    /// <summary>
    /// A change allowed only by AdministerOrganisation is the administrator's: it is audited and does not notify the
    /// owner; a grantor acting under a rule notifies them (L2-138 AC1, AC3).
    /// </summary>
    public async Task<bool> NotifiesOwnerAsync(RoleDefinition definition, CancellationToken cancellationToken = default) =>
        !ActsAsAdministrator(current.Capabilities, [.. current.HeldRoleIds], await DefinitionsAsync(cancellationToken), definition);

    public static IReadOnlySet<Guid> Grantable(
        IReadOnlyCollection<string> capabilities, IReadOnlyCollection<Guid> heldRoleIds, IReadOnlyCollection<RoleDefinition> definitions)
    {
        if (capabilities.Contains(Capability.AdministerOrganisation))
        {
            return definitions.Where(d => !d.IsArchived).Select(d => d.Id).ToHashSet();
        }

        return ByRule(capabilities, heldRoleIds, definitions);
    }

    public static bool ActsAsAdministrator(
        IReadOnlyCollection<string> capabilities, IReadOnlyCollection<Guid> heldRoleIds, IReadOnlyCollection<RoleDefinition> definitions,
        RoleDefinition definition) =>
        capabilities.Contains(Capability.AdministerOrganisation) && !ByRule(capabilities, heldRoleIds, definitions).Contains(definition.Id);

    /// <summary>What the caller's own rules allow, with no AdministerOrganisation stand-in.</summary>
    private static HashSet<Guid> ByRule(
        IReadOnlyCollection<string> capabilities, IReadOnlyCollection<Guid> heldRoleIds, IReadOnlyCollection<RoleDefinition> definitions)
    {
        if (!capabilities.Contains(Capability.AssignRoles) && !capabilities.Contains(Capability.AdministerOrganisation))
        {
            return [];
        }

        var grantable = definitions
            .Where(d => !d.IsArchived && !d.Carries(Capability.AdministerOrganisation))
            .Select(d => d.Id)
            .ToHashSet();
        return definitions
            .Where(d => heldRoleIds.Contains(d.Id) && !d.IsArchived && d.Carries(Capability.AssignRoles))
            .SelectMany(d => d.Grants.Select(g => g.GrantableRoleId))
            .Where(grantable.Contains)
            .ToHashSet();
    }

    private async Task<IReadOnlyCollection<RoleDefinition>> DefinitionsAsync(CancellationToken cancellationToken) =>
        await db.RoleDefinitions.Include(d => d.Grants).ToListAsync(cancellationToken);
}
