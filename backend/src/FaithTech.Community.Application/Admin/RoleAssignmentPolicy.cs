using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Admin;

/// <summary>
/// Who may change which role (L2-009, ADR 0033): a holder of AssignRoles the roles a grant rule of one of their roles
/// allows, never one carrying AdministerOrganisation; a holder of AdministerOrganisation any role. The web app only
/// hides options (ADR 0005). Slice 14 replaces this with RoleGrantPolicy.
/// </summary>
public class RoleAssignmentPolicy(IApplicationDbContext db, ICurrentUser current)
{
    public bool CanChangeRoles => current.Has(Capability.AssignRoles);

    public async Task<bool> CanChangeAsync(RoleDefinition definition, CancellationToken cancellationToken = default)
    {
        if (current.Capabilities.Contains(Capability.AdministerOrganisation))
        {
            return true;
        }

        if (!current.Has(Capability.AssignRoles) || definition.Capabilities.Contains(Capability.AdministerOrganisation))
        {
            return false;
        }

        var held = current.HeldRoleIds.ToList();
        return await db.RoleDefinitions
            .Where(d => held.Contains(d.Id) && d.ArchivedAtUtc == null)
            .AnyAsync(d => d.Grants.Any(g => g.GrantableRoleId == definition.Id), cancellationToken);
    }

    /// <summary>A grant by rule notifies the owner; an administrator's is audited instead (assign-roles design).</summary>
    public bool NotifiesOwner => !current.Capabilities.Contains(Capability.AdministerOrganisation);
}
