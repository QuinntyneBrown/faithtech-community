using System.Globalization;
using FaithTech.Community.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>
/// The attendance as CSV (L2-097) for lead roles and System Admins, since it carries guest emails: one row per
/// attendee in check-in list order, with name, type, guest email, RSVP time and check-in time in UTC.
/// </summary>
public class ExportCheckInsHandler(IApplicationDbContext db, EventPermissions permissions, ICsvWriter csv)
{
    private static readonly string[] Header = ["Name", "Type", "Email", "RSVP'd (UTC)", "Checked in (UTC)"];

    public async Task<(Result Result, CsvFile? File)> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanCheckIn)
        {
            return (Result.Forbidden(), null);
        }

        var e = await db.Events.AsNoTracking().Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null)
        {
            return (Result.NotFound(), null);
        }

        var memberIds = e.Rsvps.Select(r => r.ProfileId).OfType<Guid>().ToList();
        var names = await db.Profiles.AsNoTracking().Where(p => memberIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);
        var rows = e.Rsvps
            .OrderBy(r => r.IsWalkIn)
            .ThenBy(r => r.CreatedAt)
            .Select(r => (IReadOnlyList<string?>)
            [
                r.IsGuest ? r.GuestName : names.GetValueOrDefault(r.ProfileId!.Value, "A former member"),
                r.IsWalkIn ? "Walk-in" : r.IsGuest ? "Guest" : "Member",
                r.GuestEmail,
                Utc(r.CreatedAt),
                r.CheckedInAt is { } at ? Utc(at) : null,
            ]);
        return (Result.Ok(), new CsvFile($"{EventFileNames.Slug(e.Title)}-attendance.csv", csv.Write([Header, .. rows])));
    }

    private static string Utc(DateTimeOffset at) => at.UtcDateTime.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
}
