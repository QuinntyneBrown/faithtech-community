using FaithTech.Community.Domain.Organisations;
using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Admin;

public record AssignRoleCommand(string? Role);

/// <summary>Adds or removes a global role on a profile (L2-008, L2-009), audited (L2-041) and notified.</summary>
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

    public Task<(Result Result, IReadOnlyList<string>? Roles)> AssignAsync(Guid profileId, string? role, CancellationToken cancellationToken = default) =>
        ChangeAsync(profileId, role, add: true, cancellationToken);

    public Task<(Result Result, IReadOnlyList<string>? Roles)> RemoveAsync(Guid profileId, string? role, CancellationToken cancellationToken = default) =>
        ChangeAsync(profileId, role, add: false, cancellationToken);

    private async Task<(Result, IReadOnlyList<string>?)> ChangeAsync(Guid profileId, string? roleName, bool add, CancellationToken cancellationToken)
    {
        if (!policy.CanChangeRoles)
        {
            return (Result.Forbidden(), null);
        }

        // The organisation's definition with that key; slice 14 takes a definition id.
        var definition = string.IsNullOrEmpty(roleName)
            ? null
            : await db.RoleDefinitions.SingleOrDefaultAsync(d => d.Key == roleName && d.ArchivedAtUtc == null, cancellationToken);
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
        audit.Record(actor, add ? "role.granted" : "role.removed", "Profile", profileId.ToString(), new { Roles = before }, new { Roles = after });

        string? title = null;
        if (actor != profileId && await policy.NotifiesOwnerAsync(definition, cancellationToken))
        {
            var actorName = await db.Profiles.Where(p => p.Id == actor).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken) ?? "A City Lead";
            title = add
                ? $"{actorName} added the {definition.Name} role to your profile"
                : $"{actorName} removed the {definition.Name} role from your profile";
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

        return (Result.Ok(), after);
    }

    private static string[] RoleNames(Profile profile) => [.. profile.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key)];
}
