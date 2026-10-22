using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>An event as its page and the edit form show it (L2-020, L2-022), with what the caller may do.</summary>
public record EventDetailDto(
    Guid Id,
    string Title,
    string Description,
    string Type,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string City,
    string Format,
    string? Venue,
    string? OnlineLink,
    int? Capacity,
    string Visibility,
    int RsvpCount,
    bool IsCancelled,
    string? CancellationReason,
    bool CanManage);

/// <summary>Reads one event for a signed-in member; every member may see every event.</summary>
public class GetEventHandler(IApplicationDbContext db, EventPermissions permissions)
{
    public async Task<EventDetailDto?> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await db.Events.AsNoTracking().Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return e is null
            ? null
            : new EventDetailDto(
                e.Id, e.Title, e.Description, e.Type.ToString(), e.StartsAt, e.EndsAt, e.City, e.Format.ToString(), e.Venue,
                e.OnlineLink, e.Capacity, e.Visibility.ToString(), e.RsvpCount, e.IsCancelled, e.CancellationReason,
                permissions.CanManageEvents);
    }
}
