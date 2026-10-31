using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Admin;

public record AssignRoleCommand(Guid? RoleId, Guid? ChapterId = null);

/// <summary>A role a profile holds, as both role routes answer it (L2-138 AC1).</summary>
public record AssignedRoleDto(Guid Id, string Name, Guid? ChapterId);

/// <summary>
/// Adds or removes one of the organisation's roles on a profile under its grant rules (L2-138), audited (L2-041) and
/// notified when a grantor acts under a rule.
/// </summary>
public class ChangeRolesHandler(
    IApplicationDbContext db,
    RoleGrantPolicy policy,
    ProfileAccess access,
    IAuditLog audit,
    RoleChangeNotifier notifier,
    CapabilityLostHandler capabilityLost,
    LastAdministratorGuard lastAdministrator,
    TimeProvider time)
{

    public Task<(Result Result, IReadOnlyList<AssignedRoleDto>? Roles)> AssignAsync(Guid profileId, AssignRoleCommand command, CancellationToken cancellationToken = default) =>
        ChangeAsync(profileId, command.RoleId, add: true, cancellationToken);

    public Task<(Result Result, IReadOnlyList<AssignedRoleDto>? Roles)> RemoveAsync(Guid profileId, Guid roleId, CancellationToken cancellationToken = default) =>
        ChangeAsync(profileId, roleId, add: false, cancellationToken);

    private async Task<(Result, IReadOnlyList<AssignedRoleDto>?)> ChangeAsync(Guid profileId, Guid? roleId, bool add, CancellationToken cancellationToken)
    {
        if (!policy.CanChangeRoles)
        {
            return (Result.Forbidden(), null);
        }

        // A role of this organisation that is not archived; another organisation's id is not found (L2-138 AC7).
        var definition = roleId is null
            ? null
            : await db.RoleDefinitions.SingleOrDefaultAsync(d => d.Id == roleId && d.ArchivedAtUtc == null, cancellationToken);
        if (definition is null)
        {
            return (Result.Invalid("Role", "Choose a role."), null);
        }

        if (!await policy.CanGrantAsync(definition, cancellationToken))
        {
            return (Result.Forbidden(), null);
        }

        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return (Result.NotFound(), null);
        }

        if (profile.HasRole(definition.Id) == add)
        {
            return (Result.Conflict(add ? "They already hold that role." : "They don’t hold that role."), null);
        }

        if (!add && definition.Capabilities.Contains(Capability.AdministerOrganisation))
        {
            // The lease first, in a save of its own, so no overlapping change can count the administrators until
            // this one has saved; only then is the count safe to trust (L2-139 AC1, AC2).
            if (!await lastAdministrator.TakeLeaseAsync(cancellationToken))
            {
                return (Result.Conflict(LastAdministratorGuard.ConcurrentChangeMessage), null);
            }

            if (await lastAdministrator.WouldLeaveNoneAsync(profile.Id, definition.Id, cancellationToken))
            {
                lastAdministrator.Release();
                await db.SaveChangesAsync(cancellationToken);
                return (Result.Conflict(LastAdministratorGuard.LastAdministratorMessage), null);
            }

            lastAdministrator.Release();
        }

        var actor = await access.CallerProfileIdAsync(cancellationToken) ?? Guid.Empty;
        var before = RoleNames(profile);
        if (add)
        {
            profile.AddRole(definition, actor, time.GetUtcNow().UtcDateTime);
        }
        else
        {
            profile.RemoveRole(definition.Id);
        }

        var after = RoleNames(profile);
        // The role and its chapter tag beside both role sets (L2-138 AC5); chapter tags arrive with chapters (slice 21).
        audit.Record(actor, add ? "role.granted" : "role.removed", "Profile", profileId.ToString(), new { Roles = before }, new { Roles = after, Role = definition.Key, ChapterId = (Guid?)null });

        string? title = null;
        if (actor != profileId && await policy.NotifiesOwnerAsync(definition, cancellationToken))
        {
            var actorName = await db.Profiles.Where(p => p.Id == actor).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken) ?? "Someone";
            title = add ? $"{actorName} made you {definition.Name}" : $"{actorName} removed {definition.Name}";
            notifier.Notify(profileId, title);
            await notifier.QueueEmailAsync(profileId, title, cancellationToken);
        }

        foreach (var lost in profile.DomainEvents.OfType<CapabilityLost>())
        {
            await capabilityLost.HandleAsync(lost, cancellationToken);
        }

        await capabilityLost.QueueEmailsAsync(cancellationToken);
        profile.ClearDomainEvents();
        // The role change, its audit entry, the notifications and the emails commit together (L2-028, L2-047).
        await db.SaveChangesAsync(cancellationToken);

        return (Result.Ok(), Held(profile));
    }

    private static AssignedRoleDto[] Held(Profile profile) =>
        [.. profile.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => new AssignedRoleDto(r.RoleDefinitionId, r.Definition!.Name, null))];

    private static string[] RoleNames(Profile profile) => [.. profile.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key)];
}
