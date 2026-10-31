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
    ICurrentOrganisation organisation,
    TimeProvider time)
{

    public Task<(Result Result, IReadOnlyList<ProfileRoleDto>? Roles)> AssignAsync(Guid profileId, AssignRoleCommand command, CancellationToken cancellationToken = default) =>
        ChangeAsync(profileId, command.RoleId, command.ChapterId, add: true, cancellationToken);

    /// <summary>Removes the assignment of the role with exactly this chapter tag; none removes the untagged one.</summary>
    public Task<(Result Result, IReadOnlyList<ProfileRoleDto>? Roles)> RemoveAsync(Guid profileId, Guid roleId, Guid? chapterId = null, CancellationToken cancellationToken = default) =>
        ChangeAsync(profileId, roleId, chapterId, add: false, cancellationToken);

    private async Task<(Result, IReadOnlyList<ProfileRoleDto>?)> ChangeAsync(Guid profileId, Guid? roleId, Guid? chapterId, bool add, CancellationToken cancellationToken)
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

        // While chapters are off a new grant carries no tag (L2-140 AC6); a removal still names the tag it removes.
        var label = organisation.ChapterLabelSingular?.ToLowerInvariant();
        if (add && label is null)
        {
            chapterId = null;
        }

        if (add && chapterId is { } id)
        {
            if (!definition.ChapterScopable)
            {
                return (Result.Invalid("ChapterId", "That role can’t be held for a chapter."), null);
            }

            // Loaded, not just checked, so the new assignment answers with the chapter's name.
            if (await db.Chapters.FirstOrDefaultAsync(c => c.Id == id && c.ArchivedAtUtc == null, cancellationToken) is null)
            {
                return (Result.Invalid("ChapterId", $"Choose a {label} from the list."), null);
            }
        }

        if (!await policy.CanGrantAsync(definition, cancellationToken))
        {
            return (Result.Forbidden(), null);
        }

        // A grantor whose grantor role is tagged works within those chapters only (L2-143 AC1, AC2).
        var scope = await policy.ScopeAsync(definition, cancellationToken);
        if (add && chapterId is null && !scope.IsAnywhere)
        {
            return (Result.Invalid("ChapterId", $"Choose a {label}."), null);
        }

        if (!scope.Allows(chapterId))
        {
            return (Result.Forbidden(), null);
        }

        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return (Result.NotFound(), null);
        }

        if (profile.HasRole(definition.Id, chapterId) == add)
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
            profile.AddRole(definition, actor, time.GetUtcNow().UtcDateTime, chapterId);
        }
        else
        {
            profile.RemoveRole(definition.Id, chapterId);
        }

        var after = RoleNames(profile);
        // The role and its chapter tag beside both role sets (L2-138 AC5).
        audit.Record(actor, add ? "role.granted" : "role.removed", "Profile", profileId.ToString(), new { Roles = before }, new { Roles = after, Role = definition.Key, ChapterId = chapterId });

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

        return (Result.Ok(), ProfileRoleDto.Of(profile));
    }

    private static string[] RoleNames(Profile profile) => [.. profile.Roles.OrderBy(r => r.Definition!.SortOrder).Select(r => r.Definition!.Key)];
}
