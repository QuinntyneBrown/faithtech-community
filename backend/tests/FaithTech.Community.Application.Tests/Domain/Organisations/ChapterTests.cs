// Traces to: L2-140 AC4, AC5
using FaithTech.Community.Domain.Organisations;

namespace FaithTech.Community.Application.Tests.Domain.Organisations;

public class ChapterTests
{
    [Fact]
    public void A_chapter_trims_its_name_and_keeps_its_place()
    {
        var chapter = new Chapter("  Toronto ", 3);

        Assert.Equal("Toronto", chapter.Name);
        Assert.Equal(3, chapter.SortOrder);
        Assert.False(chapter.IsArchived);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void A_chapter_needs_a_name(string name) =>
        Assert.Throws<ArgumentException>(() => new Chapter(name, 0));

    [Fact]
    public void A_name_longer_than_60_characters_is_refused() =>
        Assert.Throws<ArgumentException>(() => new Chapter(new string('a', Chapter.MaxNameLength + 1), 0));

    [Fact]
    public void Rename_moves_and_archive_change_the_chapter_once()
    {
        var chapter = new Chapter("Toronto", 0);
        var archivedAt = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

        chapter.Rename(" Toronto East ");
        chapter.MoveTo(2);
        chapter.Archive(archivedAt);
        chapter.Archive(archivedAt.AddDays(1));

        Assert.Equal("Toronto East", chapter.Name);
        Assert.Equal(2, chapter.SortOrder);
        Assert.True(chapter.IsArchived);
        Assert.Equal(archivedAt, chapter.ArchivedAtUtc);
    }
}
