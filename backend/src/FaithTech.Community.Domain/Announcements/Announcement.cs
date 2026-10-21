namespace FaithTech.Community.Domain.Announcements;

public class Announcement
{
    private readonly List<AnnouncementRecipient> _recipients = [];

    private Announcement() { }

    public Announcement(string subject, string body, AnnouncementAudience audience, Guid senderId, DateTimeOffset sentAt, bool alsoEmail)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(subject);
        ArgumentException.ThrowIfNullOrWhiteSpace(body);
        Id = Guid.NewGuid();
        Subject = subject;
        Body = body;
        Audience = audience;
        SenderId = senderId;
        SentAt = sentAt;
        AlsoEmail = alsoEmail;
    }

    public Guid Id { get; private set; }

    public string Subject { get; private set; } = string.Empty;

    public string Body { get; private set; } = string.Empty;

    public AnnouncementAudience Audience { get; private set; } = null!;

    public Guid SenderId { get; private set; }

    public DateTimeOffset SentAt { get; private set; }

    public bool AlsoEmail { get; private set; }

    public IReadOnlyCollection<AnnouncementRecipient> Recipients => _recipients;

    public void AddRecipients(IEnumerable<Guid> profileIds)
    {
        foreach (var profileId in profileIds)
        {
            if (_recipients.All(r => r.ProfileId != profileId))
            {
                _recipients.Add(new AnnouncementRecipient(Id, profileId));
            }
        }
    }
}
