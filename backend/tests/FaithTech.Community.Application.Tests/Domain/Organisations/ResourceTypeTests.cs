// Traces to: L2-146 AC1
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Tests.Domain.Organisations;

public class ResourceTypeTests
{
    private static readonly DateTime Now = new(2026, 11, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void A_type_is_renamed_reordered_and_archived()
    {
        var type = new ResourceType(Guid.NewGuid(), "poster", "Poster", 8);

        type.Rename("  Event poster ");
        type.MoveTo(2);
        type.Archive(Now);

        Assert.Equal(("poster", "Event poster", 2, true), (type.Key, type.Name, type.SortOrder, type.IsArchived));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("A name that is far longer than forty characters")]
    public void A_name_is_required_and_at_most_40_characters(string name)
    {
        Assert.Throws<ArgumentException>(() => new ResourceType(Guid.NewGuid(), "x", name, 1));
    }

    // L2-146 AC1: the type keyed other is the fallback for a guessed type, so it stays.
    [Fact]
    public void The_type_keyed_other_cannot_be_archived()
    {
        var other = new ResourceType(Guid.NewGuid(), ResourceType.OtherKey, "Other", 7);

        Assert.False(other.CanArchive);
        Assert.Throws<InvalidOperationException>(() => other.Archive(Now));
        Assert.False(other.IsArchived);
    }
}
