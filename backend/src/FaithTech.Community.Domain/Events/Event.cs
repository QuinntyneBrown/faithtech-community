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

    public int RsvpCount => _rsvps.Count;

    public bool IsFull => Capacity is not null && _rsvps.Count >= Capacity;

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
