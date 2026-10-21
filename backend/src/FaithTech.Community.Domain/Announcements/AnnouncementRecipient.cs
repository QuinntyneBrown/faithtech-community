namespace FaithTech.Community.Domain.Announcements;

public class AnnouncementRecipient
{
    private AnnouncementRecipient() { }

    internal AnnouncementRecipient(Guid announcementId, Guid profileId)
    {
        AnnouncementId = announcementId;
        ProfileId = profileId;
    }

    public Guid AnnouncementId { get; private set; }

    public Guid ProfileId { get; private set; }
}
