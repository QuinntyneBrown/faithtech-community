namespace FaithTech.Community.Domain.Events;

public class Rsvp
{
    private Rsvp() { }

    internal Rsvp(
        Guid eventId, Guid? profileId, string? guestName, string? guestEmail, DateTimeOffset createdAt, bool isWalkIn = false)
    {
        IsWalkIn = isWalkIn;
        Id = Guid.NewGuid();
        EventId = eventId;
        ProfileId = profileId;
        GuestName = guestName;
        GuestEmail = guestEmail;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid EventId { get; private set; }

    public Guid? ProfileId { get; private set; }

    public string? GuestName { get; private set; }

    public string? GuestEmail { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>SHA-256 hash of the secret in a guest's cancel link; the secret itself is never stored.</summary>
    public string? CancelTokenHash { get; private set; }

    public bool IsGuest => ProfileId is null;

    /// <summary>When the attendee was marked present at the door (ADR 0029); null until checked in.</summary>
    public DateTimeOffset? CheckedInAt { get; private set; }

    /// <summary>The profile that checked them in, kept for the audit trail.</summary>
    public Guid? CheckedInById { get; private set; }

    /// <summary>Added at the door by a lead rather than RSVP'd; false for every RSVP.</summary>
    public bool IsWalkIn { get; private set; }

    public bool IsCheckedIn => CheckedInAt is not null;

    /// <summary>Marks the attendee present; an attendee already checked in keeps the first time and person (L2-119 AC4).</summary>
    internal void CheckIn(Guid byId, DateTimeOffset at)
    {
        if (IsCheckedIn)
        {
            return;
        }

        CheckedInAt = at;
        CheckedInById = byId;
    }

    internal void UndoCheckIn()
    {
        CheckedInAt = null;
        CheckedInById = null;
    }

    /// <summary>Replaces the guest's cancel link, so only the latest confirmation email can cancel the RSVP.</summary>
    public void IssueCancelToken(string tokenHash)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tokenHash);
        if (!IsGuest)
        {
            throw new InvalidOperationException("Only a guest RSVP has a cancel link.");
        }

        CancelTokenHash = tokenHash;
    }
}
