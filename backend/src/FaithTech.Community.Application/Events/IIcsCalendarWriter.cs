using FaithTech.Community.Domain.Events;

namespace FaithTech.Community.Application.Events;

/// <summary>Writes an event as an RFC 5545 calendar file (L2-024), for downloads and RSVP confirmations.</summary>
public interface IIcsCalendarWriter
{
    /// <summary>
    /// Writes the file. With <paramref name="publicPageUrl"/> (anyone's download of a public event) the URL is the
    /// public page and an online event's joining link is left out; it is for people who RSVP.
    /// </summary>
    string Write(Event calendarEvent, string? publicPageUrl = null);
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
