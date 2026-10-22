using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Admin;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Admin;

public record AssignRoleCommand(string? Role);

/// <summary>Adds or removes a global role on a profile (L2-008, L2-009), audited (L2-041) and notified.</summary>
public class ChangeRolesHandler(
    IApplicationDbContext db,
    RoleAssignmentPolicy policy,
    ProfileAccess access,
    IAuditLog audit,
    CityLeadRoleRemovedHandler cityLeadRemoved,
    INotificationPublisher notifications,
    IOptions<WebAppOptions> webApp,
    TimeProvider time)
{
    public const string LastSystemAdminMessage = "There must always be at least one System Admin.";

    public const string ConcurrentSystemAdminChangeMessage = "Someone else changed System Admin roles at the same time. Reload and try again.";

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

        if (!Enum.TryParse<Role>(roleName, ignoreCase: false, out var role) || !Enum.IsDefined(role))
        {
            return (Result.Invalid("Role", "Choose a role."), null);
        }

        if (!policy.CanChange(role))
        {
            return (Result.Forbidden(), null);
        }

        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return (Result.NotFound(), null);
        }

        if (profile.HasRole(role) == add)
        {
            return (Result.Conflict(add ? "They already hold that role." : "They don’t hold that role."), null);
        }

        SystemAdminRoster? roster = null;
        if (!add && role == Role.SystemAdmin)
        {
            // Take the roster lease in a save of its own, so no other removal can count the admins until
            // this one has saved its change; only then is the count safe to trust.
            roster = await TakeRosterLeaseAsync(cancellationToken);
            if (roster is null)
            {
                return (Result.Conflict(ConcurrentSystemAdminChangeMessage), null);
            }

            if (await db.Profiles.CountAsync(p => p.Roles.Any(r => r.Role == Role.SystemAdmin), cancellationToken) <= 1)
            {
                roster.Release();
                await db.SaveChangesAsync(cancellationToken);
                return (Result.Conflict(LastSystemAdminMessage), null);
            }

            roster.Release();
        }

        var actor = await access.CallerProfileIdAsync(cancellationToken) ?? Guid.Empty;
        var before = RoleNames(profile);
        if (add)
        {
            profile.AddRole(role, actor, time.GetUtcNow().UtcDateTime);
        }
        else
        {
            profile.RemoveRole(role);
        }

        var after = RoleNames(profile);
        audit.Record(actor, add ? "role.granted" : "role.removed", "Profile", profileId.ToString(), new { Roles = before }, new { Roles = after });

        string? title = null;
        string? actorName = null;
        if (policy.NotifiesOwner && actor != profileId)
        {
            actorName = await db.Profiles.Where(p => p.Id == actor).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken) ?? "A City Lead";
            title = add
                ? $"{actorName} added the {RoleLabels.Of(role)} role to your profile"
                : $"{actorName} removed the {RoleLabels.Of(role)} role from your profile";
        }

        foreach (var removed in profile.DomainEvents.OfType<CityLeadRoleRemoved>())
        {
            await cityLeadRemoved.HandleAsync(removed, cancellationToken);
        }

        profile.ClearDomainEvents();
        if (title is not null)
        {
            // The owner hears about it in the app and by email (L2-009 AC1), committed with the change.
            await notifications.PublishAsync(
                [profileId],
                NotificationKind.RoleChanged,
                title,
                "/people/me",
                actorName,
                new NotificationEmail("Your FaithTech Community roles changed", $"{title}.\n\nSee your profile: {webApp.Value.Origin}/people/me"),
                cancellationToken);
        }

        await cityLeadRemoved.QueueEmailsAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), after);
    }

    /// <summary>The roster with its lease taken by this request, or null when another removal holds it.</summary>
    private async Task<SystemAdminRoster?> TakeRosterLeaseAsync(CancellationToken cancellationToken)
    {
        var roster = await db.SystemAdminRosters.SingleOrDefaultAsync(r => r.Id == SystemAdminRoster.SingletonId, cancellationToken);
        if (roster is null)
        {
            db.SystemAdminRosters.Add(roster = new SystemAdminRoster());
        }

        if (!roster.TryTake(Guid.NewGuid(), time.GetUtcNow()))
        {
            return null;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return roster;
        }
        catch (DbUpdateException)
        {
            // Another removal took the lease between our read and our save.
            return null;
        }
    }

    private static string[] RoleNames(Profile profile) => [.. profile.Roles.Select(r => r.Role).Order().Select(r => r.ToString())];
}
