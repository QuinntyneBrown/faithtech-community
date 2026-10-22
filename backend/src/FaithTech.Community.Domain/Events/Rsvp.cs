namespace FaithTech.Community.Domain.Events;

public class Rsvp
{
    private Rsvp() { }

    internal Rsvp(Guid eventId, Guid? profileId, string? guestName, string? guestEmail, DateTimeOffset createdAt)
    {
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
