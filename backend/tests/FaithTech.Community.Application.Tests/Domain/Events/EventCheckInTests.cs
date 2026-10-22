// Traces to: L2-094, L2-095, L2-096 AC3 (docs/detailed-designs/events/event-check-in)
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

    // L2-095 AC2: a walk-in is added to the end of the list marked as a walk-in, checked in when asked.
    [Fact]
    public void A_walk_in_is_a_guest_row_marked_as_a_walk_in()
    {
        var (e, _) = EventWithAGuest();

        var (walkIn, reused) = e.AddWalkIn("  Mira Chen ", null, null, checkInNow: true, Lead, AtTheDoor);

        Assert.False(reused);
        Assert.Equal((true, true, "Mira Chen", (string?)null, (DateTimeOffset?)AtTheDoor), (walkIn.IsWalkIn, walkIn.IsGuest,
            walkIn.GuestName, walkIn.GuestEmail, walkIn.CheckedInAt));
        Assert.Same(walkIn, e.Rsvps.Last());
    }

    [Fact]
    public void A_walk_in_added_without_checking_in_is_not_here_yet()
    {
        var (e, _) = EventWithAGuest();

        var (walkIn, _) = e.AddWalkIn("Mira Chen", "mira@example.org", null, checkInNow: false, Lead, AtTheDoor);

        Assert.Equal(("mira@example.org", false), (walkIn.GuestEmail, walkIn.IsCheckedIn));
    }

    // L2-095 AC4: a verified member's email links the row to their profile.
    [Fact]
    public void A_walk_in_linked_to_a_member_is_a_member_row()
    {
        var (e, _) = EventWithAGuest();
        var member = Guid.NewGuid();

        var (walkIn, _) = e.AddWalkIn("Mira", "mira@example.org", member, checkInNow: true, Lead, AtTheDoor);

        Assert.Equal(((Guid?)member, (string?)null, (string?)null, true), (walkIn.ProfileId, walkIn.GuestName, walkIn.GuestEmail, walkIn.IsWalkIn));
    }

    // L2-095 AC5: the member or email already has an RSVP, so that RSVP is reused and checked in.
    [Fact]
    public void A_walk_in_reuses_a_member_rsvp_or_a_guest_rsvp_by_email()
    {
        var (e, guest) = EventWithAGuest();
        var member = Guid.NewGuid();
        var rsvp = e.Rsvp(member, Start.AddDays(-1));

        var (byMember, memberReused) = e.AddWalkIn("Someone", null, member, checkInNow: true, Lead, AtTheDoor);
        var (byEmail, emailReused) = e.AddWalkIn("Abby", "ABBY@example.org", null, checkInNow: false, Lead, AtTheDoor);

        Assert.Equal((rsvp, true, false, true), (byMember, memberReused, byMember.IsWalkIn, byMember.IsCheckedIn));
        Assert.Equal((guest, true, false), (byEmail, emailReused, byEmail.IsCheckedIn));
        Assert.Equal(2, e.AttendeeCount);
    }

    // L2-095 AC6: walk-ins skip the capacity and has-started rules.
    // L2-096 AC3: RSVP counts and fullness leave walk-ins out.
    [Fact]
    public void Walk_ins_skip_capacity_and_the_start_and_are_left_out_of_rsvp_counts()
    {
        var e = NewEvent(capacity: 1);
        e.Rsvp(Guid.NewGuid(), Start.AddDays(-1));

        e.AddWalkIn("Mira Chen", null, null, checkInNow: true, Lead, Start.AddHours(1));
        e.AddWalkIn("Ben Carter", null, null, checkInNow: true, Lead, Start.AddHours(1));

        Assert.Equal((1, true, 3, 2), (e.RsvpCount, e.IsFull, e.AttendeeCount, e.CheckedInCount));
    }

    [Fact]
    public void A_walk_in_needs_a_name()
    {
        var (e, _) = EventWithAGuest();

        Assert.Throws<ArgumentException>(() => e.AddWalkIn(" ", null, null, checkInNow: true, Lead, AtTheDoor));
    }

    // L2-094 AC5: a cancelled event takes no check-in writes.
    [Fact]
    public void A_cancelled_event_refuses_check_ins_undo_and_walk_ins()
    {
        var (e, rsvp) = EventWithAGuest();
        e.CheckIn(rsvp.Id, Lead, AtTheDoor);
        e.Cancel("The venue flooded.");

        Assert.False(e.IsCheckInOpen(AtTheDoor));
        Assert.Throws<InvalidOperationException>(() => e.CheckIn(rsvp.Id, Lead, AtTheDoor));
        Assert.Throws<InvalidOperationException>(() => e.UndoCheckIn(rsvp.Id, AtTheDoor));
        Assert.Throws<InvalidOperationException>(() => e.AddWalkIn("Mira Chen", null, null, true, Lead, AtTheDoor));
        Assert.True(rsvp.IsCheckedIn);
    }

    // L2-094 AC6: check-in opens 24 hours before the start and does not close.
    [Fact]
    public void Check_in_opens_24_hours_before_the_start_and_stays_open()
    {
        var (e, rsvp) = EventWithAGuest();
        var early = Start.AddHours(-24).AddMinutes(-1);

        Assert.Equal(Start.AddHours(-24), e.CheckInOpensAt);
        Assert.False(e.IsCheckInOpen(early));
        Assert.Throws<InvalidOperationException>(() => e.CheckIn(rsvp.Id, Lead, early));
        Assert.Throws<InvalidOperationException>(() => e.UndoCheckIn(rsvp.Id, early));
        Assert.Throws<InvalidOperationException>(() => e.AddWalkIn("Mira Chen", null, null, true, Lead, early));
        Assert.True(e.IsCheckInOpen(Start.AddHours(-24)));
        Assert.True(e.IsCheckInOpen(Start.AddDays(2)));
    }
}
