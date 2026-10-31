using FaithTech.Community.Application.Common;
using FaithTech.Community.Application.Organisations;
using FaithTech.Community.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace FaithTech.Community.Application.Events;

/// <summary>The list's chips (L2-021 AC2): one applies at a time; Online keeps to upcoming events.</summary>
public enum EventListFilter
{
    Upcoming,
    Past,
    Online,
}

/// <summary>
/// The chapter filter (L2-142 AC2): a chapter's id lists its events, <c>OrganisationWide</c> the events with no chapter.
/// Both lapse while chapters are off, and an id the organisation does not have is ignored (L2-142 AC3). A filter,
/// never a permission boundary (ADR 0034). <c>Type</c> is an event type key (L2-145 AC3); a key the organisation does not
/// have is ignored.
/// </summary>
public record ListEventsQuery(EventListFilter Filter = EventListFilter.Upcoming, Guid? ChapterId = null, bool OrganisationWide = false, string? Type = null);

/// <summary>
/// An event as the events list shows it (L2-021): date, chapter (none is organisation-wide), format, RSVP count and the
/// cancelled flag.
/// </summary>
public record EventSummaryDto(
    Guid Id,
    string Title,
    string Type,
    string TypeName,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    Guid? ChapterId,
    string? ChapterName,
    string Format,
    string? Venue,
    string Visibility,
    int RsvpCount,
    bool IsCancelled);

/// <summary>The matching events. The chapter filter's options come from the organisation's chapter list (L2-142 AC1).</summary>
public record EventListDto(IReadOnlyList<EventSummaryDto> Events);

/// <summary>Lists events for signed-in members (L2-021). Upcoming means not yet ended, soonest first; past is newest first.</summary>
public class ListEventsHandler(IApplicationDbContext db, TimeProvider time, ICurrentOrganisation organisation)
{
    public async Task<EventListDto> HandleAsync(ListEventsQuery query, CancellationToken cancellationToken = default)
    {
        var now = time.GetUtcNow();
        var events = db.Events.AsNoTracking();
        events = query.Filter switch
        {
            EventListFilter.Past => events.Where(e => e.EndsAt <= now),
            EventListFilter.Online => events.Where(e => e.EndsAt > now && e.Format == EventFormat.Online),
            _ => events.Where(e => e.EndsAt > now),
        };

        if (!string.IsNullOrEmpty(query.Type) && await db.EventTypes.AnyAsync(t => t.Key == query.Type, cancellationToken))
        {
            events = events.Where(e => e.Type!.Key == query.Type);
        }

        // The chapter query filter hides every chapter while chapters are off, so a chapter filter then lapses.
        if (query.ChapterId is { } chapterId && await db.Chapters.AnyAsync(c => c.Id == chapterId, cancellationToken))
        {
            events = events.Where(e => e.ChapterId == chapterId);
        }
        else if (query.OrganisationWide && organisation.ChapterLabelSingular is not null)
        {
            events = events.Where(e => e.ChapterId == null);
        }

        events = query.Filter == EventListFilter.Past
            ? events.OrderByDescending(e => e.StartsAt)
            : events.OrderBy(e => e.StartsAt);
        // Enums leave the database as values and become names here, so the query stays translatable.
        var rows = await events
            .Select(e => new { e.Id, e.Title, TypeKey = e.Type!.Key, TypeName = e.Type.Name, e.StartsAt, e.EndsAt, ChapterId = e.Chapter == null ? (Guid?)null : e.Chapter.Id, ChapterName = e.Chapter == null ? null : e.Chapter.Name, e.Format, e.Venue, e.Visibility, Rsvps = e.Rsvps.Count(r => !r.IsWalkIn), e.IsCancelled })
            .ToListAsync(cancellationToken);
        return new EventListDto(
            [.. rows.Select(e => new EventSummaryDto(
                e.Id, e.Title, e.TypeKey, e.TypeName, e.StartsAt, e.EndsAt, e.ChapterId, e.ChapterName, e.Format.ToString(), e.Venue,
                e.Visibility.ToString(), e.Rsvps, e.IsCancelled))]);
    }
}
