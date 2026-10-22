using FaithTech.Community.Domain.Events;

namespace FaithTech.Community.Application.Events;

/// <summary>Writes an event as an RFC 5545 calendar file (L2-024), for downloads and RSVP confirmations.</summary>
public interface IIcsCalendarWriter
{
    string Write(Event calendarEvent);
}

/// <summary>File names for an event's downloads: "toronto-builders-night.ics".</summary>
public static class EventFileNames
{
    public static string Slug(string title)
    {
        var chars = title.ToLowerInvariant().Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-').ToArray();
        var slug = string.Join('-', new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
        return slug.Length == 0 ? "event" : slug.Length > 60 ? slug[..60].TrimEnd('-') : slug;
    }

    public static string Calendar(string title) => $"{Slug(title)}.ics";
}
