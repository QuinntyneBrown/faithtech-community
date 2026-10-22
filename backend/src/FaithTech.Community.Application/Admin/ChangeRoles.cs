using FaithTech.Community.Application.Agile;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Profiles;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Admin;

public record AssignRoleCommand(string? Role);

/// <summary>Adds or removes a global role on a profile (L2-008, L2-009), audited (L2-041) and notified.</summary>
public class ChangeRolesHandler(
    IApplicationDbContext db,
    RoleAssignmentPolicy policy,
    ProfileAccess access,
    IAuditLog audit,
    RoleChangeNotifier notifier,
    CityLeadRoleRemovedHandler cityLeadRemoved,
    TimeProvider time)
{
    public const string LastSystemAdminMessage = "There must always be at least one System Admin.";

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

        if (!add && role == Role.SystemAdmin
            && await db.Profiles.CountAsync(p => p.Roles.Any(r => r.Role == Role.SystemAdmin), cancellationToken) <= 1)
        {
            return (Result.Conflict(LastSystemAdminMessage), null);
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
        if (policy.NotifiesOwner && actor != profileId)
        {
            var actorName = await db.Profiles.Where(p => p.Id == actor).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken) ?? "A City Lead";
            title = add
                ? $"{actorName} added the {RoleLabels.Of(role)} role to your profile"
                : $"{actorName} removed the {RoleLabels.Of(role)} role from your profile";
            notifier.Notify(profileId, title);
        }

        foreach (var removed in profile.DomainEvents.OfType<CityLeadRoleRemoved>())
        {
            await cityLeadRemoved.HandleAsync(removed, cancellationToken);
        }

        profile.ClearDomainEvents();
        await db.SaveChangesAsync(cancellationToken);
        await cityLeadRemoved.SendEmailsAsync(cancellationToken);
        if (title is not null)
        {
            await notifier.EmailAsync(profileId, title, cancellationToken);
        }

        return (Result.Ok(), after);
    }

    private static string[] RoleNames(Profile profile) => [.. profile.Roles.Select(r => r.Role).Order().Select(r => r.ToString())];
}
