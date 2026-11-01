namespace FaithTech.Community.Domain.Events;

/// <summary>
/// The kinds of hub section, in the order a new hub lists them (docs/proposals/event-hubs.md, phase 1). A kind added later
/// is appended, and that slice's migration adds it to existing hubs hidden (ADR 0036).
/// </summary>
public enum HubSectionKind
{
    Hero,
    Agenda,
    Venue,
    People,
    Links,
    Giving,
    UpcomingEvents,
}
