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

    [Theory]
    [InlineData("", "/events/42")]
    [InlineData("Cancelled", " ")]
    public void A_notification_needs_a_title_and_a_link(string title, string linkPath)
    {
        Assert.Throws<ArgumentException>(() => new Notification(Recipient, NotificationKind.Invite, title, linkPath, Now));
    }

    // The item a notice names is its link; the rest of the sentence is plain text (L2-027 AC7).
    [Fact]
    public void A_notification_can_name_the_phrase_of_its_title_that_links_to_the_item()
    {
        var notification = new Notification(
            Recipient, NotificationKind.EventCancelled, "Builders night was cancelled", "/events/42", Now, linkText: "Builders night");

        Assert.Equal("Builders night", notification.LinkText);
        Assert.Null(NewNotification().LinkText);
    }

    [Fact]
    public void The_link_phrase_must_be_part_of_the_title()
    {
        Assert.Throws<ArgumentException>(() => new Notification(
            Recipient, NotificationKind.EventCancelled, "Builders night was cancelled", "/events/42", Now, linkText: "Open it"));
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
