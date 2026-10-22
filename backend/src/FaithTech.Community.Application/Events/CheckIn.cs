using FaithTech.Community.Application.Admin;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>
/// Someone on the check-in list (L2-093). <see cref="Email"/> is a guest's email, for leads and System Admins only;
/// a member has none, as on the RSVP list.
/// </summary>
public record CheckInAttendeeDto(
    Guid RsvpId,
    Guid? ProfileId,
    string Name,
    bool IsGuest,
    bool IsWalkIn,
    string? Email,
    DateTimeOffset RsvpedAt,
    DateTimeOffset? CheckedInAt);

/// <summary>
/// The check-in page (L2-092, L2-093): the event, whether the caller may edit and export, and every attendee in RSVP
/// order with walk-ins last. <see cref="Going"/> counts every attendee, walk-ins included.
/// </summary>
public record CheckInDto(
    Guid EventId,
    string Title,
    DateTimeOffset StartsAt,
    string City,
    string Format,
    string? Venue,
    bool IsCancelled,
    string? CancellationReason,
    DateTimeOffset CheckInOpensAt,
    bool IsOpen,
    bool CanEdit,
    bool CanExport,
    int Going,
    int CheckedIn,
    int WalkIns,
    IReadOnlyList<CheckInAttendeeDto> Attendees);

/// <summary>
/// Check-in at the door (L2-092 to L2-094, ADR 0025): lead roles and System Admins check attendees in and undo;
/// Staff read the list without guest emails. The check-in is stored on the attendee's RSVP row.
/// </summary>
public class CheckInHandler(IApplicationDbContext db, EventPermissions permissions, IAuditLog audit, TimeProvider time)
{
    public const string Cancelled = "This event was cancelled.";
    public const string NotOpen = "Check-in hasn’t opened yet.";

    /// <summary>
    /// Why the event takes no check-in writes, or null when it does (L2-094 AC5, AC6). The not-yet-open conflict
    /// carries <c>opensAt</c>.
    /// </summary>
    public static Result? Refusal(Event e, DateTimeOffset now) =>
        e.IsCancelled ? Result.Conflict(Cancelled)
        : now < e.CheckInOpensAt ? Result.Conflict(NotOpen, new Dictionary<string, object?> { ["opensAt"] = e.CheckInOpensAt })
        : null;

    /// <summary>A System Admin without a lead role writing a check-in is audited (L2-092 AC5).</summary>
    public void AuditOverride(Guid actor, string action, Event e, Rsvp rsvp, string name)
    {
        if (permissions.IsCheckInOverride)
        {
            audit.Record(actor, action, "Event", e.Id.ToString(), null, new { RsvpId = rsvp.Id, Name = name });
        }
    }

    public async Task<(Result Result, CheckInDto? CheckIn)> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanViewCheckIn)
        {
            return (Result.Forbidden(), null);
        }

        var e = await db.Events.AsNoTracking().Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null)
        {
            return (Result.NotFound(), null);
        }

        var names = await NamesAsync(e.Rsvps, cancellationToken);
        var attendees = e.Rsvps
            .OrderBy(r => r.IsWalkIn)
            .ThenBy(r => r.CreatedAt)
            .Select(r => Attendee(r, names))
            .ToList();
        return (Result.Ok(), new CheckInDto(
            e.Id, e.Title, e.StartsAt, e.City, e.Format.ToString(), e.Venue, e.IsCancelled, e.CancellationReason,
            e.CheckInOpensAt, e.IsCheckInOpen(time.GetUtcNow()), permissions.CanCheckIn, permissions.CanCheckIn,
            e.AttendeeCount, e.CheckedInCount, e.Rsvps.Count(r => r.IsWalkIn), attendees));
    }

    /// <summary>Marks the attendee present; saving again keeps the first time (L2-094 AC1, AC4).</summary>
    public async Task<(Result Result, CheckInAttendeeDto? Attendee)> CheckInAsync(
        Guid id, Guid rsvpId, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanCheckIn || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return (Result.Forbidden(), null);
        }

        var e = await db.Events.Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null || e.Rsvps.All(r => r.Id != rsvpId))
        {
            return (Result.NotFound(), null);
        }

        if (Refusal(e, time.GetUtcNow()) is { } refusal)
        {
            return (refusal, null);
        }

        var rsvp = e.CheckIn(rsvpId, actor, time.GetUtcNow());
        var attendee = await AttendeeAsync(rsvp, cancellationToken);
        AuditOverride(actor, "event.checked_in", e, rsvp, attendee.Name);
        await db.SaveChangesAsync(cancellationToken);
        return (Result.Ok(), attendee);
    }

    /// <summary>One attendee as the caller may see them, with a member's profile name.</summary>
    public async Task<CheckInAttendeeDto> AttendeeAsync(Rsvp rsvp, CancellationToken cancellationToken = default) =>
        Attendee(rsvp, await NamesAsync([rsvp], cancellationToken));

    /// <summary>Clears the attendee's check-in (L2-094 AC2).</summary>
    public async Task<Result> UndoAsync(Guid id, Guid rsvpId, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanCheckIn || await permissions.CallerProfileIdAsync(cancellationToken) is not { } actor)
        {
            return Result.Forbidden();
        }

        var e = await db.Events.Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null || e.Rsvps.All(r => r.Id != rsvpId))
        {
            return Result.NotFound();
        }

        if (Refusal(e, time.GetUtcNow()) is { } refusal)
        {
            return refusal;
        }

        var rsvp = e.UndoCheckIn(rsvpId, time.GetUtcNow());
        AuditOverride(actor, "event.check_in_undone", e, rsvp, (await AttendeeAsync(rsvp, cancellationToken)).Name);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    private CheckInAttendeeDto Attendee(Rsvp r, IReadOnlyDictionary<Guid, string> names) => r.IsGuest
        ? new CheckInAttendeeDto(r.Id, null, r.GuestName!, true, r.IsWalkIn,
            permissions.CanSeeGuestEmails ? r.GuestEmail : null, r.CreatedAt, r.CheckedInAt)
        : new CheckInAttendeeDto(r.Id, r.ProfileId, names.GetValueOrDefault(r.ProfileId!.Value, "A former member"), false,
            r.IsWalkIn, null, r.CreatedAt, r.CheckedInAt);

    private async Task<IReadOnlyDictionary<Guid, string>> NamesAsync(IEnumerable<Rsvp> rsvps, CancellationToken cancellationToken)
    {
        var memberIds = rsvps.Select(r => r.ProfileId).OfType<Guid>().ToList();
        return await db.Profiles.AsNoTracking().Where(p => memberIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
    }
}
