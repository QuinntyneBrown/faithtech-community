using FaithTech.Community.Application.Common;
using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>The list's chips (L2-021 AC2): one applies at a time; Hackathons and Online keep to upcoming events.</summary>
public enum EventListFilter
{
    Upcoming,
    Past,
    Hackathons,
    Online,
}

/// <summary>The city is a filter on where the event is held, never a permission boundary.</summary>
public record ListEventsQuery(EventListFilter Filter = EventListFilter.Upcoming, string? City = null);

/// <summary>An event as the events list shows it (L2-021): date, city, format, RSVP count and the cancelled flag.</summary>
public record EventSummaryDto(
    Guid Id,
    string Title,
    string Type,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string City,
    string Format,
    string? Venue,
    string Visibility,
    int RsvpCount,
    bool IsCancelled);

/// <summary>The matching events, and every city that has an event whatever the filters.</summary>
public record EventListDto(IReadOnlyList<EventSummaryDto> Events, IReadOnlyList<string> Cities);

/// <summary>Lists events for signed-in members (L2-021). Upcoming means not yet ended, soonest first; past is newest first.</summary>
public class ListEventsHandler(IApplicationDbContext db, TimeProvider time)
{
    public async Task<EventListDto> HandleAsync(ListEventsQuery query, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var events = db.Events.AsNoTracking();
        events = query.Filter switch
        {
            EventListFilter.Past => events.Where(e => e.EndsAt <= now),
            EventListFilter.Hackathons => events.Where(e => e.EndsAt > now && e.Type == EventType.Hackathon),
            EventListFilter.Online => events.Where(e => e.EndsAt > now && e.Format == EventFormat.Online),
            _ => events.Where(e => e.EndsAt > now),
        };

        var city = query.City?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(city))
        {
            events = events.Where(e => e.City.Trim().ToLower() == city);
        }

        events = query.Filter == EventListFilter.Past
            ? events.OrderByDescending(e => e.StartsAt)
            : events.OrderBy(e => e.StartsAt);
        // Enums leave the database as values and become names here, so the query stays translatable.
        var rows = await events
            .Select(e => new { e.Id, e.Title, e.Type, e.StartsAt, e.EndsAt, e.City, e.Format, e.Venue, e.Visibility, Rsvps = e.Rsvps.Count(r => !r.IsWalkIn), e.IsCancelled })
            .ToListAsync(cancellationToken);

        var cities = await db.Events.AsNoTracking().Select(e => e.City).Distinct().ToListAsync(cancellationToken);
        return new EventListDto(
            [.. rows.Select(e => new EventSummaryDto(
                e.Id, e.Title, e.Type.ToString(), e.StartsAt, e.EndsAt, e.City, e.Format.ToString(), e.Venue,
                e.Visibility.ToString(), e.Rsvps, e.IsCancelled))],
            [.. cities
                .Select(c => c.Trim())
                .Where(c => c.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Order(StringComparer.OrdinalIgnoreCase)]);
    }
}
