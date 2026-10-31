// Traces to: L2-029, L2-030
using FaithTech.Community.Domain.Announcements;
using FaithTech.Community.Domain.Profiles;

namespace FaithTech.Community.Application.Tests.Domain.Announcements;

public class AnnouncementTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid Sender = Guid.NewGuid();

    [Fact]
    public void An_audience_can_be_everyone()
    {
        var audience = AnnouncementAudience.Everyone();

        Assert.Equal((AudienceKind.Everyone, 0, (Guid?)null), (audience.Kind, audience.RoleIds.Count, audience.EventId));
    }

    [Fact]
    public void An_audience_can_be_the_holders_of_one_or_more_roles()
    {
        var (volunteer, eventLead) = (TestRoles.Definition(Role.Volunteer).Id, TestRoles.Definition(Role.EventLead).Id);
        var audience = AnnouncementAudience.ForRoles(volunteer, eventLead, volunteer);

        Assert.Equal(AudienceKind.Roles, audience.Kind);
        Assert.Equal(new HashSet<Guid> { volunteer, eventLead }, audience.RoleIds);
    }

    [Fact]
    public void A_role_audience_needs_at_least_one_role()
    {
        Assert.Throws<ArgumentException>(() => AnnouncementAudience.ForRoles());
    }

    [Fact]
    public void An_audience_can_be_one_events_rsvp_list()
    {
        var eventId = Guid.NewGuid();

        var audience = AnnouncementAudience.ForEventRsvps(eventId);

        Assert.Equal((AudienceKind.EventRsvps, (Guid?)eventId), (audience.Kind, audience.EventId));
    }

    [Fact]
    public void An_announcement_holds_its_subject_body_audience_sender_and_time()
    {
        var audience = AnnouncementAudience.Everyone();

        var announcement = new Announcement("Hackathon dates", "Save the date.", audience, Sender, Now, alsoEmail: true);

        Assert.Equal(
            ("Hackathon dates", "Save the date.", audience, Sender, Now, true),
            (announcement.Subject, announcement.Body, announcement.Audience, announcement.SenderId, announcement.SentAt, announcement.AlsoEmail));
    }

    [Theory]
    [InlineData("", "Body")]
    [InlineData("Subject", " ")]
    public void An_announcement_needs_a_subject_and_a_body(string subject, string body)
    {
        Assert.Throws<ArgumentException>(() => new Announcement(subject, body, AnnouncementAudience.Everyone(), Sender, Now, alsoEmail: false));
    }

    [Fact]
    public void Recipients_are_recorded_once_each()
    {
        var announcement = new Announcement("Subject", "Body", AnnouncementAudience.Everyone(), Sender, Now, alsoEmail: true);
        var ada = Guid.NewGuid();
        var grace = Guid.NewGuid();

        announcement.AddRecipients([ada, grace, ada]);
        announcement.AddRecipients([grace]);

        Assert.Equal([ada, grace], announcement.Recipients.Select(r => r.ProfileId));
        Assert.All(announcement.Recipients, r => Assert.Equal(announcement.Id, r.AnnouncementId));
    }
}
