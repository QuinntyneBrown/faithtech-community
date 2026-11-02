using System.Text.RegularExpressions;
using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>The day-of update banner (L2-189 AC1 to AC3).</summary>
public record SetHubUpdateCommand(string? Text);

/// <summary>
/// Quick edits a lead makes on the day (L2-188 to L2-190, ADR 0044). They need ManageEventHubs, change the hub at once and
/// are audited only when AdministerOrganisation overrides.
/// </summary>
public partial class HubQuickEditsHandler(IApplicationDbContext db, EventPermissions permissions, IAuditLog audit, TimeProvider time)
{
    public const int MaxUpdate = 280;

    public async Task<Result> SetUpdateAsync(Guid eventId, SetHubUpdateCommand command, CancellationToken cancellationToken = default)
    {
        var (hub, actor, refusal) = await HubAsync(eventId, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        var text = string.IsNullOrWhiteSpace(command.Text) ? null : Spaces().Replace(command.Text.Trim(), " ");
        if (text is null)
        {
            return Result.Invalid("text", "Write the update.");
        }

        if (text.Length > MaxUpdate)
        {
            return Result.Invalid("text", "Use 280 characters or fewer.");
        }

        hub!.PostUpdate(text, time.GetUtcNow());
        Audit(actor!.Value, hub, new { Update = text });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    public async Task<Result> ClearUpdateAsync(Guid eventId, CancellationToken cancellationToken = default)
    {
        var (hub, actor, refusal) = await HubAsync(eventId, cancellationToken);
        if (refusal is not null)
        {
            return refusal;
        }

        hub!.ClearUpdate(time.GetUtcNow());
        Audit(actor!.Value, hub, new { Update = (string?)null });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    /// <summary>The caller's hub for the event, or why not: 403 without the capability, 404 without a hub or event.</summary>
    private async Task<(EventHub? Hub, Guid? Actor, Result? Refusal)> HubAsync(Guid eventId, CancellationToken cancellationToken)
    {
        if (!permissions.CanManageHubs || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return (null, null, Result.Forbidden());
        }

        var hub = await db.EventHubs.Include(h => h.Sections).SingleOrDefaultAsync(h => h.EventId == eventId, cancellationToken);
        if (hub is null || !await db.Events.AnyAsync(e => e.Id == eventId, cancellationToken))
        {
            return (null, null, Result.NotFound());
        }

        return (hub, actor, null);
    }

    private void Audit(Guid actor, EventHub hub, object after)
    {
        if (permissions.IsHubOverride)
        {
            audit.Record(actor, "event_hub.updated", "EventHub", hub.Id.ToString(), null, after);
        }
    }

    [GeneratedRegex(@"[ \t]+")]
    private static partial Regex Spaces();
}
