// Traces to: L2-111 (docs/detailed-designs/partners/partner-activity-timeline)
using FaithTech.Community.Application.Partners;

namespace FaithTech.Community.Application.Tests.Common;

public class TimelineCursorTests
{
    [Theory]
    [InlineData("14:15:30")]
    [InlineData(null)]
    public void A_cursor_round_trips(string? time)
    {
        var cursor = new TimelineCursor(
            new DateOnly(2026, 10, 16),
            time is null ? null : TimeOnly.Parse(time),
            new DateTime(2026, 10, 16, 18, 20, 11, DateTimeKind.Utc),
            Guid.NewGuid());

        Assert.True(TimelineCursor.TryDecode(cursor.Encode(), out var decoded));
        Assert.Equal(cursor, decoded);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-cursor")]
    [InlineData("MjAyNi0xMC0xNnx8")]
    [InlineData("!!!")]
    public void A_malformed_cursor_is_rejected(string value)
    {
        Assert.False(TimelineCursor.TryDecode(value, out _));
    }
}
