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

    public bool IsGuest => ProfileId is null;
}
