using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Organisations;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Admin;

/// <summary>
/// Who may add and remove which role, from the organisation's grant rules (ADR 0033, L2-137, L2-138). A holder of
/// AdministerOrganisation may change any role that is not archived; a holder of AssignRoles the roles a grant rule of
/// one of their non-archived roles that carries AssignRoles allows, never one carrying AdministerOrganisation. The web
/// app offers exactly these (grantableRoleIds) and the API refuses the rest.
/// </summary>
public class RoleGrantPolicy(IApplicationDbContext db, ICurrentUser current, ICurrentOrganisation organisation)
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

    /// <summary>
    /// The chapters within which the caller may grant and remove <paramref name="definition"/> (L2-143): anywhere for a
    /// definition that is not chapter-scopable, for a holder of AdministerOrganisation, while chapters are off, and when
    /// any of the caller's assignments of a role whose rule grants it is untagged; otherwise those assignments' chapters.
    /// </summary>
    public async Task<GrantorScope> ScopeAsync(RoleDefinition definition, CancellationToken cancellationToken = default) =>
        Scope(current.Capabilities, current.Roles, organisation.ChapterLabelSingular is not null, await DefinitionsAsync(cancellationToken), definition);

    public static GrantorScope Scope(
        IReadOnlyCollection<string> capabilities, IReadOnlyCollection<HeldRole> held, bool chaptersOn,
        IReadOnlyCollection<RoleDefinition> definitions, RoleDefinition definition)
    {
        if (!definition.ChapterScopable || !chaptersOn || capabilities.Contains(Capability.AdministerOrganisation))
        {
            return GrantorScope.Anywhere;
        }

        var grantors = definitions
            .Where(d => !d.IsArchived && d.Carries(Capability.AssignRoles) && d.Grants.Any(g => g.GrantableRoleId == definition.Id))
            .Select(d => d.Id)
            .ToHashSet();
        var assignments = held.Where(r => grantors.Contains(r.Id)).ToList();
        return assignments.Any(r => r.ChapterId is null)
            ? GrantorScope.Anywhere
            : new GrantorScope(assignments.Select(r => r.ChapterId!.Value).ToHashSet());
    }

    /// <summary>
    /// The chapters the caller may tag a grant with, for /api/me (L2-133 AC1): null when they are never scoped,
    /// otherwise the tags of their assignments of any role that carries AssignRoles.
    /// </summary>
    public async Task<IReadOnlyCollection<Guid>?> GrantChapterIdsAsync(CancellationToken cancellationToken = default)
    {
        if (organisation.ChapterLabelSingular is null || current.Capabilities.Contains(Capability.AdministerOrganisation))
        {
            return null;
        }

        var grantorIds = (await DefinitionsAsync(cancellationToken))
            .Where(d => !d.IsArchived && d.Carries(Capability.AssignRoles)).Select(d => d.Id).ToHashSet();
        var grantorRoles = current.Roles.Where(r => grantorIds.Contains(r.Id)).ToList();
        return grantorRoles.Count == 0 || grantorRoles.Any(r => r.ChapterId is null)
            ? null
            : [.. grantorRoles.Select(r => r.ChapterId!.Value).Distinct()];
    }

    private async Task<IReadOnlyCollection<RoleDefinition>> DefinitionsAsync(CancellationToken cancellationToken) =>
        await db.RoleDefinitions.Include(d => d.Grants).ToListAsync(cancellationToken);
}

/// <summary>Where a grantor may grant: anywhere, or only within these chapters (L2-143).</summary>
public sealed record GrantorScope(IReadOnlySet<Guid>? Chapters)
{
    public static readonly GrantorScope Anywhere = new((IReadOnlySet<Guid>?)null);

    public bool IsAnywhere => Chapters is null;

    /// <summary>Whether an assignment with this tag may be granted or removed; a scoped grantor never touches an untagged one.</summary>
    public bool Allows(Guid? chapterId) => Chapters is null || (chapterId is { } id && Chapters.Contains(id));
}
