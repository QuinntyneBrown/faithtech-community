// Traces to: L2-027, L2-028
using FaithTech.Community.Domain.Notifications;

namespace FaithTech.Community.Application.Tests.Domain.Notifications;

public class NotificationTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid Recipient = Guid.NewGuid();

    private static Notification NewNotification() =>
        new(Recipient, NotificationKind.EventCancelled, "Builders night was cancelled", "/events/42", Now);

    [Fact]
    public void A_new_notification_is_addressed_to_one_recipient_and_unread()
    {
        var notification = NewNotification();

        Assert.Equal(
            (Recipient, NotificationKind.EventCancelled, "Builders night was cancelled", "/events/42", Now, false),
            (notification.RecipientId, notification.Kind, notification.Title, notification.LinkPath, notification.CreatedAt, notification.IsRead));
    }

    [Fact]
    public void A_notification_may_name_the_person_who_caused_it()
    {
        Assert.Null(NewNotification().ActorName);
        Assert.Equal("Hannah Kim", new Notification(Recipient, NotificationKind.Announcement, "Builders Night moves", "/announcements", Now, "Hannah Kim").ActorName);
    }

    [Theory]
    [InlineData("", "/events/42")]
    [InlineData("Cancelled", " ")]
    public void A_notification_needs_a_title_and_a_link(string title, string linkPath)
    {
        Assert.Throws<ArgumentException>(() => new Notification(Recipient, NotificationKind.Invite, title, linkPath, Now));
    }

    [Fact]
    public void Marking_read_records_when_it_was_read()
    {
        var notification = NewNotification();

        notification.MarkRead(Now.AddMinutes(5));

        Assert.Equal((true, (DateTimeOffset?)Now.AddMinutes(5)), (notification.IsRead, notification.ReadAt));
    }

    [Fact]
    public void Marking_read_again_keeps_the_first_read_time()
    {
        var notification = NewNotification();
        notification.MarkRead(Now.AddMinutes(5));

        notification.MarkRead(Now.AddMinutes(9));

        Assert.Equal(Now.AddMinutes(5), notification.ReadAt);
    }
}
