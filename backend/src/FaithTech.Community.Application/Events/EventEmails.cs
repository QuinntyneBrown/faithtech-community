using System.Globalization;
using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;

namespace FaithTech.Community.Application.Events;

/// <summary>The lines event emails share: when and where it is, and its .ics attachment (L2-022, L2-024, L2-025).</summary>
public static class EventEmails
{
    /// <summary>"Friday 6 November 2026, 18:30 UTC": emails go to people in many time zones.</summary>
    public static string When(Event e) =>
        $"{e.StartsAt.UtcDateTime.ToString("dddd d MMMM yyyy, HH:mm", CultureInfo.InvariantCulture)} UTC";

    public static string Where(Event e) => e.Format == EventFormat.Online ? e.OnlineLink ?? "Online" : $"{e.Venue}, {e.City}";

    public static EmailAttachment Calendar(Event e, IIcsCalendarWriter calendar) =>
        new(EventFileNames.Calendar(e.Title), "text/calendar", calendar.Write(e));
}
