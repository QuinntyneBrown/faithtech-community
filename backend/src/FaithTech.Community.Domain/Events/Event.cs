namespace FaithTech.Community.Domain.Events;

public class Event
{
    private readonly List<Rsvp> _rsvps = [];

    private Event() { }

    public Event(
        string title,
        string description,
        EventType type,
        DateTimeOffset startsAt,
        DateTimeOffset endsAt,
        string city,
        EventFormat format,
        string? venue,
        string? onlineLink,
        int? capacity,
        EventVisibility visibility,
        Guid createdById)
    {
        Id = Guid.NewGuid();
        CreatedById = createdById;
        Apply(title, description, type, startsAt, endsAt, city, format, venue, onlineLink, capacity, visibility);
    }

    public Guid Id { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public EventType Type { get; private set; }

    public DateTimeOffset StartsAt { get; private set; }

    public DateTimeOffset EndsAt { get; private set; }

    public string City { get; private set; } = string.Empty;

    public EventFormat Format { get; private set; }

    public string? Venue { get; private set; }

    public string? OnlineLink { get; private set; }

    public int? Capacity { get; private set; }

    public EventVisibility Visibility { get; private set; }

    public bool IsCancelled { get; private set; }

    public string? CancellationReason { get; private set; }

    public Guid? CancelledById { get; private set; }

    public DateTimeOffset? CancelledAt { get; private set; }

    public int Sequence { get; private set; }

    public Guid CreatedById { get; private set; }

    public IReadOnlyCollection<Rsvp> Rsvps => _rsvps;

    /// <summary>People who RSVP'd. Walk-ins did not, so they are left out and never take a seat (L2-096 AC3).</summary>
    public int RsvpCount => _rsvps.Count(r => !r.IsWalkIn);

    public bool IsFull => Capacity is not null && RsvpCount >= Capacity;

    public void Update(
        string title,
        string description,
        EventType type,
        DateTimeOffset startsAt,
        DateTimeOffset endsAt,
        string city,
        EventFormat format,
        string? venue,
        string? onlineLink,
        int? capacity,
        EventVisibility visibility)
    {
        Apply(title, description, type, startsAt, endsAt, city, format, venue, onlineLink, capacity, visibility);
        Sequence++;
    }

    public void Cancel(string reason, Guid? cancelledById = null, DateTimeOffset? cancelledAt = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(reason);
        if (IsCancelled)
        {
            throw new InvalidOperationException("The event is already cancelled.");
        }

        IsCancelled = true;
        CancellationReason = reason;
        CancelledById = cancelledById;
        CancelledAt = cancelledAt;
        Sequence++;
    }

    public Rsvp Rsvp(Guid profileId, DateTimeOffset now)
    {
        var existing = _rsvps.FirstOrDefault(r => r.ProfileId == profileId);
        return existing ?? AddRsvp(new Rsvp(Id, profileId, null, null, now), now);
    }

    public Rsvp GuestRsvp(string name, string email, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        var existing = _rsvps.FirstOrDefault(r => string.Equals(r.GuestEmail, email, StringComparison.OrdinalIgnoreCase));
        return existing ?? AddRsvp(new Rsvp(Id, null, name, email, now), now);
    }

    /// <summary>Check-in opens a day before the start and does not close (L2-094 AC6).</summary>
    public static readonly TimeSpan CheckInOpensBefore = TimeSpan.FromHours(24);

    public DateTimeOffset CheckInOpensAt => StartsAt - CheckInOpensBefore;

    /// <summary>A cancelled event has no check-in window.</summary>
    public bool IsCheckInOpen(DateTimeOffset now) => !IsCancelled && now >= CheckInOpensAt;

    /// <summary>Everyone who checked in, walk-ins included.</summary>
    public int CheckedInCount => _rsvps.Count(r => r.IsCheckedIn);

    /// <summary>Everyone on the check-in list: every RSVP and every walk-in.</summary>
    public int AttendeeCount => _rsvps.Count;

    /// <summary>Marks an attendee of this event present at the door (L2-094).</summary>
    public Rsvp CheckIn(Guid rsvpId, Guid byId, DateTimeOffset now)
    {
        EnsureCheckInOpen(now);
        var rsvp = Attendee(rsvpId);
        rsvp.CheckIn(byId, now);
        return rsvp;
    }

    /// <summary>Clears an attendee's check-in (L2-094 AC2).</summary>
    public Rsvp UndoCheckIn(Guid rsvpId, DateTimeOffset now)
    {
        EnsureCheckInOpen(now);
        var rsvp = Attendee(rsvpId);
        rsvp.UndoCheckIn();
        return rsvp;
    }

    /// <summary>
    /// Adds someone at the door (L2-095). It skips the capacity and has-started rules that close RSVPs, and reuses
    /// the member's RSVP, or a guest RSVP with the same email, rather than adding a second row.
    /// </summary>
    public (Rsvp Rsvp, bool Reused) AddWalkIn(
        string name, string? email, Guid? profileId, bool checkInNow, Guid byId, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        EnsureCheckInOpen(now);
        email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        var existing = profileId is { } member
            ? _rsvps.FirstOrDefault(r => r.ProfileId == member)
            : email is null ? null : _rsvps.FirstOrDefault(r => string.Equals(r.GuestEmail, email, StringComparison.OrdinalIgnoreCase));
        var rsvp = existing ?? (profileId is not null
            ? new Rsvp(Id, profileId, null, null, now, isWalkIn: true)
            : new Rsvp(Id, null, name.Trim(), email, now, isWalkIn: true));
        if (existing is null)
        {
            _rsvps.Add(rsvp);
        }

        if (checkInNow)
        {
            rsvp.CheckIn(byId, now);
        }

        return (rsvp, existing is not null);
    }

    private void EnsureCheckInOpen(DateTimeOffset now)
    {
        if (IsCancelled)
        {
            throw new InvalidOperationException("The event is cancelled.");
        }

        if (now < CheckInOpensAt)
        {
            throw new InvalidOperationException("Check-in has not opened yet.");
        }
    }

    private Rsvp Attendee(Guid rsvpId) =>
        _rsvps.FirstOrDefault(r => r.Id == rsvpId) ?? throw new InvalidOperationException("There is no such RSVP.");

    public void CancelRsvp(Guid profileId) =>
        RemoveRsvp(_rsvps.FirstOrDefault(r => r.ProfileId == profileId));

    public void CancelGuestRsvp(Guid rsvpId) =>
        RemoveRsvp(_rsvps.FirstOrDefault(r => r.Id == rsvpId && r.IsGuest));

    private Rsvp AddRsvp(Rsvp rsvp, DateTimeOffset now)
    {
        if (IsCancelled)
        {
            throw new InvalidOperationException("The event is cancelled.");
        }

        if (now >= StartsAt)
        {
            throw new InvalidOperationException("The event has already started.");
        }

        if (IsFull)
        {
            throw new InvalidOperationException("This event is full.");
        }

        _rsvps.Add(rsvp);
        return rsvp;
    }

    private void RemoveRsvp(Rsvp? rsvp)
    {
        if (rsvp is null)
        {
            throw new InvalidOperationException("There is no such RSVP.");
        }

        _rsvps.Remove(rsvp);
    }

    private void Apply(
        string title,
        string description,
        EventType type,
        DateTimeOffset startsAt,
        DateTimeOffset endsAt,
        string city,
        EventFormat format,
        string? venue,
        string? onlineLink,
        int? capacity,
        EventVisibility visibility)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(city);
        if (endsAt < startsAt)
        {
            throw new ArgumentException("An event cannot end before it starts.", nameof(endsAt));
        }

        if (format == EventFormat.InPerson && string.IsNullOrWhiteSpace(venue))
        {
            throw new ArgumentException("An in-person event needs a venue.", nameof(venue));
        }

        if (format == EventFormat.Online && string.IsNullOrWhiteSpace(onlineLink))
        {
            throw new ArgumentException("An online event needs a link.", nameof(onlineLink));
        }

        if (capacity is not null)
        {
            ArgumentOutOfRangeException.ThrowIfNegativeOrZero(capacity.Value, nameof(capacity));
        }

        Title = title;
        Description = description;
        Type = type;
        StartsAt = startsAt;
        EndsAt = endsAt;
        City = city;
        Format = format;
        Venue = venue;
        OnlineLink = onlineLink;
        Capacity = capacity;
        Visibility = visibility;
    }
}
