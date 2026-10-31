// Traces to: L2-145 AC1, AC2
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Tests.Domain.Organisations;

public class EventTypeTests
{
    private static readonly DateTime Now = new(2026, 11, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void A_type_is_renamed_reordered_and_archived()
    {
        var type = new EventType(Guid.NewGuid(), "workshop", "Workshop", 6);

        type.Rename("  Hands-on workshop ");
        type.MoveTo(2);
        type.Archive(Now);

        Assert.Equal(("workshop", "Hands-on workshop", 2, true), (type.Key, type.Name, type.SortOrder, type.IsArchived));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("A name that is far longer than forty characters")]
    public void A_name_is_required_and_at_most_40_characters(string name)
    {
        Assert.Throws<ArgumentException>(() => new EventType(Guid.NewGuid(), "x", name, 1));
    }

    [Fact]
    public void An_event_references_its_type()
    {
        var e = new Event("Toronto Builders Night", "", TestEventTypes.BuildersNight, Now, Now.AddHours(2), null,
            EventFormat.Online, null, "https://meet.example.org/b", null, EventVisibility.Public, Guid.NewGuid());

        e.Update("Toronto Panel", "", TestEventTypes.Panel, Now, Now.AddHours(2), null,
            EventFormat.Online, null, "https://meet.example.org/b", null, EventVisibility.Public);

        Assert.Equal((TestEventTypes.Panel.Id, "panel"), (e.TypeId, e.Type!.Key));
    }
}
