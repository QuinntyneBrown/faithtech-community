using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>
/// Publishes and unpublishes a hub (L2-164, ADR 0039). Needs <c>ManageEventHubs</c> (403); an event without a hub, or of another
/// organisation, is 404. Publishing refuses nothing. Every status change is audited, marked as an override when only
/// <c>AdministerOrganisation</c> allowed it.
/// </summary>
public class PublishEventHubHandler(IApplicationDbContext db, EventPermissions permissions, IAuditLog audit, TimeProvider time)
{
    public async Task<Result> PublishAsync(Guid eventId, CancellationToken cancellationToken = default) =>
        await ChangeAsync(eventId, "event_hub.published", hub =>
        {
            hub.Publish(time.GetUtcNow());
            return true;
        }, cancellationToken);

    public async Task<Result> UnpublishAsync(Guid eventId, CancellationToken cancellationToken = default) =>
        await ChangeAsync(eventId, "event_hub.unpublished", hub => hub.Unpublish(time.GetUtcNow()), cancellationToken);

    private async Task<Result> ChangeAsync(Guid eventId, string action, Func<EventHub, bool> change, CancellationToken cancellationToken)
    {
        if (!permissions.CanManageHubs || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return Result.Forbidden();
        }

        var hub = await db.EventHubs.SingleOrDefaultAsync(h => h.EventId == eventId, cancellationToken);
        if (hub is null || !await db.Events.AnyAsync(e => e.Id == eventId, cancellationToken))
        {
            return Result.NotFound();
        }

        if (change(hub))
        {
            audit.Record(actor, action, "EventHub", hub.Id.ToString(), null, new { Override = permissions.IsHubOverride, hub.PublishedAt });
            await db.SaveChangesAsync(cancellationToken);
        }

        return Result.Ok();
    }
}
