// Traces to: L2-094 (docs/detailed-designs/events/event-check-in)
using FaithTech.Community.Domain.Events;
using static FaithTech.Community.Application.Tests.Domain.Events.EventTests;

namespace FaithTech.Community.Application.Tests.Domain.Events;

public class EventCheckInTests
{
    private static readonly DateTimeOffset AtTheDoor = Start.AddMinutes(10);
    private static readonly Guid Lead = Guid.NewGuid();

    private static (Event Event, Rsvp Rsvp) EventWithAGuest()
    {
        var e = NewEvent();
        return (e, e.GuestRsvp("Abby Brooks", "abby@example.org", Start.AddDays(-2)));
    }

    [Fact]
    public void A_new_rsvp_is_not_checked_in_and_not_a_walk_in()
    {
        var (_, rsvp) = EventWithAGuest();

        Assert.Equal((false, false, null, null), (rsvp.IsCheckedIn, rsvp.IsWalkIn, rsvp.CheckedInAt, rsvp.CheckedInById));
    }

    // L2-094 AC1: the check-in records the time and who checked them in.
    [Fact]
    public void Checking_in_records_the_time_and_who_checked_them_in()
    {
        var (e, rsvp) = EventWithAGuest();

        var checkedIn = e.CheckIn(rsvp.Id, Lead, AtTheDoor);

        Assert.Same(rsvp, checkedIn);
        Assert.Equal((true, (DateTimeOffset?)AtTheDoor, (Guid?)Lead), (rsvp.IsCheckedIn, rsvp.CheckedInAt, rsvp.CheckedInById));
        Assert.Equal((1, 1), (e.CheckedInCount, e.AttendeeCount));
    }

    // L2-094 AC4: Given an attendee already checked in, when the check-in is saved again, then the original time is kept.
    [Fact]
    public void Checking_in_again_keeps_the_first_time_and_person()
    {
        var (e, rsvp) = EventWithAGuest();
        e.CheckIn(rsvp.Id, Lead, AtTheDoor);

        e.CheckIn(rsvp.Id, Guid.NewGuid(), AtTheDoor.AddMinutes(5));

        Assert.Equal(((DateTimeOffset?)AtTheDoor, (Guid?)Lead), (rsvp.CheckedInAt, rsvp.CheckedInById));
    }

    // L2-094 AC2: undo clears the check-in.
    [Fact]
    public void Undoing_clears_the_check_in()
    {
        var (e, rsvp) = EventWithAGuest();
        e.CheckIn(rsvp.Id, Lead, AtTheDoor);

        e.UndoCheckIn(rsvp.Id, AtTheDoor.AddMinutes(1));

        Assert.Equal((false, null, null, 0), (rsvp.IsCheckedIn, rsvp.CheckedInAt, rsvp.CheckedInById, e.CheckedInCount));
    }

    [Fact]
    public void An_rsvp_on_another_event_cannot_be_checked_in()
    {
        var (e, _) = EventWithAGuest();

        Assert.Throws<InvalidOperationException>(() => e.CheckIn(Guid.NewGuid(), Lead, AtTheDoor));
        Assert.Throws<InvalidOperationException>(() => e.UndoCheckIn(Guid.NewGuid(), AtTheDoor));
    }
}
