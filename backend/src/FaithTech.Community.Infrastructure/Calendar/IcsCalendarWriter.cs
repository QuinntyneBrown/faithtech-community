using System.Globalization;
using System.Text;
using FaithTech.Community.Application.Events;
using FaithTech.Community.Domain.Events;

namespace FaithTech.Community.Infrastructure.Calendar;

/// <summary>
/// One VEVENT per file (RFC 5545): a UID from the event id that never changes, UTC times, the venue as LOCATION or
/// the online link as URL, SEQUENCE from <see cref="Event.Sequence"/> and STATUS:CANCELLED once cancelled, so
/// calendar apps replace the copy they already hold (L2-024).
/// </summary>
public class IcsCalendarWriter(TimeProvider time) : IIcsCalendarWriter
{
    private const int MaxLineOctets = 75;

    public string Write(Event calendarEvent)
    {
        var e = calendarEvent;
        var lines = new List<string>
        {
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//FaithTech Community//Events//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            $"UID:{e.Id}@faithtech.community",
            $"DTSTAMP:{Utc(time.GetUtcNow())}",
            $"DTSTART:{Utc(e.StartsAt)}",
            $"DTEND:{Utc(e.EndsAt)}",
            $"SUMMARY:{Text(e.Title)}",
        };
        if (!string.IsNullOrWhiteSpace(e.Description))
        {
            lines.Add($"DESCRIPTION:{Text(e.Description)}");
        }

        if (e.Format == EventFormat.InPerson && e.Venue is { } venue)
        {
            lines.Add($"LOCATION:{Text($"{venue}, {e.City}")}");
        }

        if (e.Format == EventFormat.Online && e.OnlineLink is { } link)
        {
            lines.Add($"URL:{link}");
        }

        lines.Add($"SEQUENCE:{e.Sequence.ToString(CultureInfo.InvariantCulture)}");
        lines.Add(e.IsCancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED");
        lines.Add("END:VEVENT");
        lines.Add("END:VCALENDAR");

        var ics = new StringBuilder();
        foreach (var line in lines)
        {
            Fold(ics, line);
        }

        return ics.ToString();
    }

    private static string Utc(DateTimeOffset value) =>
        value.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);

    // TEXT values escape backslash, semicolon, comma and newlines (RFC 5545 3.3.11).
    private static string Text(string value) => value
        .Replace("\\", "\\\\", StringComparison.Ordinal)
        .Replace(";", "\\;", StringComparison.Ordinal)
        .Replace(",", "\\,", StringComparison.Ordinal)
        .Replace("\r\n", "\\n", StringComparison.Ordinal)
        .Replace("\n", "\\n", StringComparison.Ordinal)
        .Replace("\r", "\\n", StringComparison.Ordinal);

    // Lines longer than 75 octets continue on the next line after CRLF and a space, never splitting a character.
    private static void Fold(StringBuilder ics, string line)
    {
        var octets = 0;
        var limit = MaxLineOctets;
        var enumerator = StringInfo.GetTextElementEnumerator(line);
        while (enumerator.MoveNext())
        {
            var element = enumerator.GetTextElement();
            var size = Encoding.UTF8.GetByteCount(element);
            if (octets + size > limit)
            {
                ics.Append("\r\n ");
                octets = 1;
                limit = MaxLineOctets;
            }

            ics.Append(element);
            octets += size;
        }

        ics.Append("\r\n");
    }
}
