using System.Globalization;
using System.Text;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Notifications;
using FaithTech.Community.Domain.Events;
using FaithTech.Community.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FaithTech.Community.Application.Events;

/// <summary>A CSV download: the file name and its text.</summary>
public record CsvFile(string FileName, string Content);

/// <summary>
/// Member RSVPs (L2-022): RSVP with an in-app and email confirmation carrying the .ics, cancel and RSVP again before
/// the event, and the CSV export for leads and System Admins. A cancelled, started or full event refuses new RSVPs.
/// </summary>
public class RsvpHandler(
    IApplicationDbContext db,
    EventPermissions permissions,
    INotificationPublisher notifications,
    IIcsCalendarWriter calendar,
    IEmailQueue emails,
    IOptions<WebAppOptions> webApp,
    TimeProvider time)
{
    public const string Cancelled = "This event was cancelled.";
    public const string Started = "This event has already started.";
    public const string Full = "This event is full.";

    public async Task<Result> RsvpAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (await permissions.CallerProfileIdAsync(cancellationToken) is not { } me)
        {
            return Result.Forbidden();
        }

        var e = await db.Events.Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null)
        {
            return Result.NotFound();
        }

        if (e.Rsvps.Any(r => r.ProfileId == me))
        {
            return Result.Ok();
        }

        if (Refusal(e, time.GetUtcNow()) is { } refusal)
        {
            return Result.Conflict(refusal);
        }

        e.Rsvp(me, time.GetUtcNow());
        var title = $"You’re going to {e.Title}";
        var link = $"/events/{e.Id}";
        notifications.Publish(me, NotificationKind.RsvpConfirmed, title, link);

        var address = await db.Users.Where(u => u.ProfileId == me).Select(u => u.Email).SingleOrDefaultAsync(cancellationToken);
        if (address is not null)
        {
            emails.Enqueue(Confirmation(e, address, $"{webApp.Value.Origin}{link}"));
        }

        // The RSVP, its notification and its confirmation commit together (L2-028).
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    public async Task<Result> CancelAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (await permissions.CallerProfileIdAsync(cancellationToken) is not { } me)
        {
            return Result.Forbidden();
        }

        var e = await db.Events.Include(x => x.Rsvps).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (e is null || e.Rsvps.All(r => r.ProfileId != me))
        {
            return Result.NotFound();
        }

        e.CancelRsvp(me);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Ok();
    }

    /// <summary>The RSVP list as CSV for leads and System Admins: name, member or guest, guest email and time.</summary>
    public async Task<(Result Result, CsvFile? File)> ExportAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (!permissions.CanExportRsvps)
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
        var csv = new StringBuilder("Name,Member or guest,Guest email,RSVP'd (UTC)\r\n");
        foreach (var r in e.Rsvps.OrderBy(r => r.CreatedAt))
        {
            var name = r.IsGuest ? r.GuestName! : names.GetValueOrDefault(r.ProfileId!.Value, "A former member");
            csv.Append(Cell(name)).Append(',')
                .Append(r.IsGuest ? "Guest" : "Member").Append(',')
                .Append(Cell(r.GuestEmail ?? string.Empty)).Append(',')
                .Append(r.CreatedAt.UtcDateTime.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)).Append("\r\n");
        }

        return (Result.Ok(), new CsvFile($"{EventFileNames.Slug(e.Title)}-rsvps.csv", csv.ToString()));
    }

    /// <summary>Why the event takes no new RSVPs, or null when it does (L2-020 AC5, L2-022 AC2).</summary>
    public static string? Refusal(Event e, DateTimeOffset now) =>
        e.IsCancelled ? Cancelled : now >= e.StartsAt ? Started : e.IsFull ? Full : null;

    /// <summary>The confirmation email with the event's .ics attached (L2-022 AC1, L2-023 AC2).</summary>
    public EmailMessage Confirmation(Event e, string address, string pageUrl, string? extra = null) => new(
        address,
        $"You’re going to {e.Title}",
        $"You’re going to {e.Title}.\n\n" +
        $"{e.StartsAt.UtcDateTime.ToString("dddd d MMMM yyyy, HH:mm", CultureInfo.InvariantCulture)} UTC\n" +
        $"{(e.Format == EventFormat.Online ? e.OnlineLink : $"{e.Venue}, {e.City}")}\n\n" +
        $"The calendar invite is attached. See the event: {pageUrl}" +
        (extra is null ? string.Empty : $"\n\n{extra}"),
        [new EmailAttachment(EventFileNames.Calendar(e.Title), "text/calendar", calendar.Write(e))]);

    // Quotes a CSV cell when it holds a comma, quote or line break, and neutralises spreadsheet formulas.
    private static string Cell(string value)
    {
        if (value.Length > 0 && "=+-@".Contains(value[0], StringComparison.Ordinal))
        {
            value = "'" + value;
        }

        return value.IndexOfAny([',', '"', '\r', '\n']) >= 0 ? $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\"" : value;
    }
}
