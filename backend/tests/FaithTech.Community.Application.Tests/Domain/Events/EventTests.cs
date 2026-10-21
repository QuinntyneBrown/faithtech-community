// Traces to: L2-020, L2-024, L2-025
using FaithTech.Community.Domain.Events;

namespace FaithTech.Community.Application.Tests.Domain.Events;

public class EventTests
{
    internal static readonly DateTimeOffset Start = new(2026, 11, 5, 18, 0, 0, TimeSpan.Zero);
    internal static readonly Guid Creator = Guid.NewGuid();

    internal static Event NewEvent(int? capacity = null) =>
        new("Builders night", "Ship something.", EventType.BuildersNight, Start, Start.AddHours(3), "Toronto",
            EventFormat.InPerson, "The Hub", null, capacity, EventVisibility.Public, Creator);

    [Fact]
    public void A_new_event_holds_its_details_and_starts_at_sequence_zero()
    {
        var created = NewEvent(capacity: 40);

        Assert.Equal(
            ("Builders night", EventType.BuildersNight, Start, Start.AddHours(3), "Toronto", EventFormat.InPerson, (string?)"The Hub", (int?)40, EventVisibility.Public, Creator),
            (created.Title, created.Type, created.StartsAt, created.EndsAt, created.City, created.Format, created.Venue, created.Capacity, created.Visibility, created.CreatedById));
        Assert.Equal((0, false), (created.Sequence, created.IsCancelled));
    }

    [Fact]
    public void An_event_needs_a_title()
    {
        Assert.Throws<ArgumentException>(() => new Event(" ", "", EventType.Gathering, Start, Start.AddHours(1), "Toronto",
            EventFormat.Online, null, "https://meet.example.org", null, EventVisibility.MembersOnly, Creator));
    }

    [Fact]
    public void An_event_cannot_end_before_it_starts()
    {
        Assert.Throws<ArgumentException>(() => new Event("Panel", "", EventType.Panel, Start, Start.AddMinutes(-1), "Toronto",
            EventFormat.Online, null, "https://meet.example.org", null, EventVisibility.MembersOnly, Creator));
    }

    [Fact]
    public void An_in_person_event_needs_a_venue()
    {
        Assert.Throws<ArgumentException>(() => new Event("Panel", "", EventType.Panel, Start, Start.AddHours(1), "Toronto",
            EventFormat.InPerson, " ", null, null, EventVisibility.MembersOnly, Creator));
    }

    [Fact]
    public void An_online_event_needs_a_link()
    {
        Assert.Throws<ArgumentException>(() => new Event("Panel", "", EventType.Panel, Start, Start.AddHours(1), "Toronto",
            EventFormat.Online, "The Hub", null, null, EventVisibility.MembersOnly, Creator));
    }

    [Fact]
    public void A_capacity_must_be_positive()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => NewEvent(capacity: 0));
    }

    [Fact]
    public void Updating_applies_the_edits_and_increments_the_sequence()
    {
        var edited = NewEvent();

        edited.Update("Hackathon", "Build for good.", EventType.Hackathon, Start, Start.AddDays(1), "Online",
            EventFormat.Online, null, "https://meet.example.org", 100, EventVisibility.MembersOnly);

        Assert.Equal(
            ("Hackathon", EventType.Hackathon, EventFormat.Online, (string?)"https://meet.example.org", (int?)100, EventVisibility.MembersOnly, 1),
            (edited.Title, edited.Type, edited.Format, edited.OnlineLink, edited.Capacity, edited.Visibility, edited.Sequence));
    }

    [Fact]
    public void An_invalid_update_changes_nothing()
    {
        var edited = NewEvent();

        Assert.Throws<ArgumentException>(() => edited.Update("Builders night", "", EventType.BuildersNight, Start, Start.AddHours(-1),
            "Toronto", EventFormat.InPerson, "The Hub", null, null, EventVisibility.Public));
        Assert.Equal((Start.AddHours(3), 0), (edited.EndsAt, edited.Sequence));
    }

    [Fact]
    public void Cancelling_marks_the_event_cancelled_with_the_reason_and_increments_the_sequence()
    {
        var cancelled = NewEvent();

        cancelled.Cancel("Venue flooded");

        Assert.Equal((true, (string?)"Venue flooded", 1), (cancelled.IsCancelled, cancelled.CancellationReason, cancelled.Sequence));
    }

    [Fact]
    public void Cancelling_needs_a_reason()
    {
        Assert.Throws<ArgumentException>(() => NewEvent().Cancel(""));
    }

    [Fact]
    public void A_cancelled_event_cannot_be_cancelled_again()
    {
        var cancelled = NewEvent();
        cancelled.Cancel("Venue flooded");

        Assert.Throws<InvalidOperationException>(() => cancelled.Cancel("Again"));
    }
}
