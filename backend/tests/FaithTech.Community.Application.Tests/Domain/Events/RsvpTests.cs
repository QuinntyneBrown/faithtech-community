// Traces to: L2-020, L2-022, L2-023, L2-025
using FaithTech.Community.Domain.Events;
using static FaithTech.Community.Application.Tests.Domain.Events.EventTests;

namespace FaithTech.Community.Application.Tests.Domain.Events;

public class RsvpTests
{
    private static readonly DateTimeOffset Before = Start.AddDays(-2);

    [Fact]
    public void A_member_rsvp_is_recorded()
    {
        var gathering = NewEvent();
        var member = Guid.NewGuid();

        var rsvp = gathering.Rsvp(member, Before);

        Assert.Equal((gathering.Id, (Guid?)member, false, Before), (rsvp.EventId, rsvp.ProfileId, rsvp.IsGuest, rsvp.CreatedAt));
        Assert.Equal(1, gathering.RsvpCount);
    }

    [Fact]
    public void Rsvping_twice_keeps_a_single_rsvp()
    {
        var gathering = NewEvent();
        var member = Guid.NewGuid();

        var first = gathering.Rsvp(member, Before);
        var second = gathering.Rsvp(member, Before.AddHours(1));

        Assert.Same(first, second);
        Assert.Equal(1, gathering.RsvpCount);
    }

    [Fact]
    public void A_cancelled_event_refuses_new_rsvps()
    {
        var gathering = NewEvent();
        gathering.Cancel("Venue flooded");

        Assert.Throws<InvalidOperationException>(() => gathering.Rsvp(Guid.NewGuid(), Before));
        Assert.Throws<InvalidOperationException>(() => gathering.GuestRsvp("Grace", "grace@example.org", Before));
    }

    [Fact]
    public void An_event_at_capacity_refuses_new_rsvps()
    {
        var gathering = NewEvent(capacity: 2);
        gathering.Rsvp(Guid.NewGuid(), Before);
        gathering.GuestRsvp("Grace", "grace@example.org", Before);

        Assert.True(gathering.IsFull);
        Assert.Throws<InvalidOperationException>(() => gathering.Rsvp(Guid.NewGuid(), Before));
    }

    [Fact]
    public void An_event_that_has_started_refuses_new_rsvps()
    {
        Assert.Throws<InvalidOperationException>(() => NewEvent().Rsvp(Guid.NewGuid(), Start));
    }

    [Fact]
    public void Cancelling_an_rsvp_removes_it_and_the_member_can_rsvp_again()
    {
        var gathering = NewEvent();
        var member = Guid.NewGuid();
        gathering.Rsvp(member, Before);

        gathering.CancelRsvp(member);
        Assert.Equal(0, gathering.RsvpCount);

        gathering.Rsvp(member, Before.AddHours(1));
        Assert.Equal(1, gathering.RsvpCount);
    }

    [Fact]
    public void Cancelling_an_rsvp_that_does_not_exist_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => NewEvent().CancelRsvp(Guid.NewGuid()));
    }

    [Fact]
    public void A_guest_rsvp_records_name_and_email_without_a_profile()
    {
        var gathering = NewEvent();

        var rsvp = gathering.GuestRsvp("Grace", "grace@example.org", Before);

        Assert.Equal(((Guid?)null, true, (string?)"Grace", (string?)"grace@example.org"), (rsvp.ProfileId, rsvp.IsGuest, rsvp.GuestName, rsvp.GuestEmail));
    }

    [Theory]
    [InlineData("", "grace@example.org")]
    [InlineData("Grace", " ")]
    public void A_guest_rsvp_needs_a_name_and_an_email(string name, string email)
    {
        Assert.Throws<ArgumentException>(() => NewEvent().GuestRsvp(name, email, Before));
    }

    [Fact]
    public void The_same_guest_email_keeps_a_single_rsvp()
    {
        var gathering = NewEvent();

        var first = gathering.GuestRsvp("Grace", "grace@example.org", Before);
        var second = gathering.GuestRsvp("Grace H", "Grace@Example.org", Before);

        Assert.Same(first, second);
        Assert.Equal(1, gathering.RsvpCount);
    }

    [Fact]
    public void A_guest_can_cancel_their_rsvp_by_its_id()
    {
        var gathering = NewEvent();
        var rsvp = gathering.GuestRsvp("Grace", "grace@example.org", Before);

        gathering.CancelGuestRsvp(rsvp.Id);

        Assert.Equal(0, gathering.RsvpCount);
    }

    [Fact]
    public void Cancelling_an_unknown_guest_rsvp_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => NewEvent().CancelGuestRsvp(Guid.NewGuid()));
    }
}
