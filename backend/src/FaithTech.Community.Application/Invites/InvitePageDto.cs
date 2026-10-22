using System.Globalization;

namespace FaithTech.Community.Application.Invites;

/// <summary>A page of invites. <c>Next</c> continues the list and is null on the last page.</summary>
public record InvitePageDto(IReadOnlyList<InviteDto> Items, string? Next, int TotalCount);

/// <summary>The position after the last invite of a page: its creation time and id, newest first.</summary>
public readonly record struct InviteCursor(DateTimeOffset CreatedAt, Guid Id)
{
    public override string ToString() =>
        $"{CreatedAt.UtcTicks.ToString(CultureInfo.InvariantCulture)}_{Id:N}";

    public static InviteCursor? Parse(string? value)
    {
        var parts = value?.Split('_');
        return parts is [var ticks, var id]
            && long.TryParse(ticks, NumberStyles.None, CultureInfo.InvariantCulture, out var utcTicks)
            && utcTicks is >= 0 and <= 3155378975999999999
            && Guid.TryParseExact(id, "N", out var guid)
                ? new InviteCursor(new DateTimeOffset(utcTicks, TimeSpan.Zero), guid)
                : null;
    }
}
