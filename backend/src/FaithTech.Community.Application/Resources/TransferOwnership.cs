using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Domain.Notifications;
using FaithTech.Community.Domain.Resources;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Resources;

public record TransferOwnershipCommand(Guid? OwnerId);

/// <summary>
/// A System Admin hands a resource to another member who can own resources (L2-064 AC3 to AC7). Visibility, audience,
/// tags and file stay as they are; the transfer is audited and the new owner is notified, all in one save.
/// </summary>
public class TransferOwnershipHandler(
    IApplicationDbContext db, ResourceAccess access, AddResourcesHandler contributors, ResourceViews views, INotificationPublisher publisher, IAuditLog audit)
{
    public const string ChooseMessage = "Choose who should own it.";

    public async Task<(Result Result, ResourceDto? Resource)> HandleAsync(Guid id, TransferOwnershipCommand command, CancellationToken cancellationToken = default)
    {
        if (!access.IsSystemAdmin)
        {
            return (Result.Forbidden(), null);
        }

        var caller = await access.CallerAsync(cancellationToken);
        var resource = await access.FindAsync(id, caller, cancellationToken);
        if (resource is null)
        {
            return (Result.NotFound(), null);
        }

        if (command.OwnerId is not { } ownerId)
        {
            return (Result.Invalid("OwnerId", ChooseMessage), null);
        }

        var candidate = await db.Profiles.Where(p => p.Id == ownerId && !p.IsSuspended && p.UserId != null)
            .Select(p => new { p.Name }).SingleOrDefaultAsync(cancellationToken);
        var role = candidate is null ? null : await contributors.OwnerRoleAsync(ownerId, cancellationToken);
        if (role is null)
        {
            return (Result.Invalid("OwnerId", "Choose a lead, Staff member or System Admin; only they can own resources."), null);
        }

        var previous = resource.OwnerId;
        if (previous == ownerId)
        {
            return (Result.Ok(), await views.DetailAsync(resource, caller, cancellationToken));
        }

        resource.SetOwner(ownerId, role);
        audit.Record(caller, "resource.owner.transferred", nameof(Resource), resource.Id.ToString(), new { OwnerId = previous }, new { OwnerId = ownerId });
        var admin = await db.Profiles.Where(p => p.Id == caller).Select(p => p.Name).SingleAsync(cancellationToken);
        var title = $"{admin} made you the owner of {resource.Title}";
        await publisher.PublishAsync(
            [ownerId],
            NotificationKind.ResourceOwnershipTransferred,
            title,
            $"/resources/{resource.Id}",
            caller,
            _ => new NotificationEmail(title, $"{admin} made you the owner of “{resource.Title}”. You can now edit, share or archive it."),
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), await views.DetailAsync(resource, caller, cancellationToken));
    }
}
