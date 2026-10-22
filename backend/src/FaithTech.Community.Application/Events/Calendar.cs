using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Events;

/// <summary>An .ics download: the file name and its text.</summary>
public record CalendarFile(string FileName, string Content);

/// <summary>
/// Event calendar files (L2-024). Signed-in members may download any event; anyone may download a public event,
/// whose copy links the public page instead of an online event's joining link. Unknown or hidden events are null.
/// </summary>
public class GetEventCalendarHandler(IApplicationDbContext db, IIcsCalendarWriter calendar, IOptions<WebAppOptions> webApp)
{
    public async Task<CalendarFile?> ForMemberAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await db.Events.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return e is null ? null : new CalendarFile(EventFileNames.Calendar(e.Title), calendar.Write(e));
    }

    public async Task<CalendarFile?> ForAnyoneAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await db.Events.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id && x.Visibility == EventVisibility.Public, cancellationToken);
        return e is null
            ? null
            : new CalendarFile(EventFileNames.Calendar(e.Title), calendar.Write(e, $"{webApp.Value.Origin}/public/events/{e.Id}"));
    }
}
