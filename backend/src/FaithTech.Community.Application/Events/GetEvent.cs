using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>
/// Someone who RSVP'd. <see cref="GuestEmail"/> is null for a member, and for Staff (L2-022 AC4);
/// <see cref="CheckedInAt"/> is when they were checked in at the door, if they were (L2-096).
/// </summary>
public record RsvpDto(
    Guid? ProfileId, string Name, bool IsGuest, string? GuestEmail, DateTimeOffset RsvpedAt, DateTimeOffset? CheckedInAt = null);

/// <summary>
/// An event as its page and the edit form show it (L2-020, L2-022), with what the caller may do. <see cref="Rsvps"/>
/// is null unless the caller is a lead, Staff or System Admin; attendees see only <see cref="RsvpCount"/>.
/// <see cref="CheckedInCount"/>, walk-ins included, is for the same callers (L2-096 AC1, AC2).
/// </summary>
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
    bool IsFull,
    bool IsCancelled,
    string? CancellationReason,
    string? CancelledByName,
    DateTimeOffset? CancelledAt,
    string? HostName,
    string? HostRole,
    bool CallerHasRsvp,
    bool CanManage,
    bool CanExportRsvps,
    IReadOnlyList<RsvpDto>? Rsvps,
    int? CheckedInCount = null,
    bool CanCheckIn = false,
    bool CanViewCheckIn = false);

/// <summary>Reads one event for a signed-in member; every member may see every event.</summary>
public class GetEventHandler(IApplicationDbContext db, EventPermissions permissions)
{
    private static readonly Role[] HostRoles = [Role.EventLead, Role.CityLead, Role.SystemAdmin];

    public async Task<EventDetailDto?> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await db.Events.AsNoTracking().Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null)
        {
            return null;
        }

        var caller = await permissions.CallerProfileIdAsync(cancellationToken);
        var host = await db.Profiles.AsNoTracking().SingleOrDefaultAsync(p => p.Id == e.CreatedById, cancellationToken);
        var cancelledBy = e.CancelledById is { } by
            ? await db.Profiles.AsNoTracking().Where(p => p.Id == by).Select(p => p.Name).SingleOrDefaultAsync(cancellationToken)
            : null;
        var hostRole = host is null ? null : HostRoles.Where(host.HasRole).Select(r => (Role?)r).FirstOrDefault();

        IReadOnlyList<RsvpDto>? rsvps = null;
        if (permissions.CanSeeRsvpList)
        {
            // Walk-ins did not RSVP, so the RSVP list leaves them out (L2-096 AC3).
            var rsvped = e.Rsvps.Where(r => !r.IsWalkIn).ToList();
            var memberIds = rsvped.Select(r => r.ProfileId).OfType<Guid>().ToList();
            var names = await db.Profiles.AsNoTracking().Where(p => memberIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
            var emails = permissions.CanSeeGuestEmails;
            rsvps = [.. rsvped
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => r.IsGuest
                    ? new RsvpDto(null, r.GuestName!, true, emails ? r.GuestEmail : null, r.CreatedAt, r.CheckedInAt)
                    : new RsvpDto(r.ProfileId, names.GetValueOrDefault(r.ProfileId!.Value, "A former member"), false, null,
                        r.CreatedAt, r.CheckedInAt))];
        }

        return new EventDetailDto(
            e.Id, e.Title, e.Description, e.Type.ToString(), e.StartsAt, e.EndsAt, e.City, e.Format.ToString(), e.Venue,
            e.OnlineLink, e.Capacity, e.Visibility.ToString(), e.RsvpCount, e.IsFull, e.IsCancelled, e.CancellationReason,
            cancelledBy, e.CancelledAt, host?.Name, hostRole is { } role ? RoleLabels.Of(role) : null,
            caller is { } me && e.Rsvps.Any(r => r.ProfileId == me),
            permissions.CanManageEvents, permissions.CanExportRsvps, rsvps,
            permissions.CanSeeRsvpList ? e.CheckedInCount : null, permissions.CanCheckIn, permissions.CanViewCheckIn);
    }
}
