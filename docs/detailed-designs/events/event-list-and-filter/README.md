# Event list and filter

## Overview

FaithTech Community lists events for signed-in members. An *event* is a dated gathering, held in person or online, that members can attend. Data is global, so the list spans every city.

This feature covers the events list page: upcoming events in date order, filtered by city, with an empty state and a clear cancelled marker. It is the entry point to the rest of the events subsystem.

Key terms:

- **upcoming event** — event whose end time has not passed
- **RSVP count** — number of members and guests who have RSVP'd to an event
- **city filter** — list constraint that keeps only events held in the chosen city

## Description

- **`EventsPage`** — routed page in the `events` feature library (mock: `docs/mocks/pages/events/`). It renders the loading, empty, no-results and error states and the city filter, and lists event cards from the `components` library.
- **`EventsService` / `EVENTS_SERVICE`** — API client contract and token; `HttpEventsService.listEvents(filter)` calls the API.
- **`EventsEndpoints`** — maps `GET /api/events?city=` with authentication required.
- **`ListEventsQuery`** — query carrying the optional city.
- **`ListEventsHandler`** — Application handler that selects upcoming events soonest first, applies the city filter, and projects each to `EventSummaryDto` with date, city, format, RSVP count and cancelled flag.
- **`EventSummaryDto`** — read model returned to the page.
- **`CommunityDbContext`** — EF Core context that reads events and RSVP counts.

Paging size and whether past events are reachable from this page are `<TO SUPPLY>`.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-021` | `L1-008` | Event list and filter |

### Acceptance criteria

**`L2-021` — Event list and filter**

1. Given a signed-in member, when they open events, then upcoming events are listed soonest first, with date, city, format and RSVP count.
2. Given a city filter, or one of the filters Upcoming, Past, Hackathons or Online, when it is applied, then only matching events are listed.
3. Given no matching events, when the list is shown, then an empty state is shown.
4. Given a cancelled event, when it is listed, then it is clearly marked as cancelled.

## Diagrams

### System context

Members browse events in FaithTech Community.

![C4 system context for event list and filter](diagrams/c4-context.png)

### Containers

The `EventsPage` calls the Community API, which reads events and RSVP counts from the Community database.

![C4 container view for event list and filter](diagrams/c4-container.png)

### Components

`EventsEndpoints` dispatches `ListEventsQuery` to `ListEventsHandler`, which projects events into summaries.

![C4 component view for event list and filter](diagrams/c4-component.png)

### Class structure

`ListEventsHandler` reads `Event` and its `Rsvp` records and returns `EventSummaryDto` rows.

![Class diagram for event list and filter](diagrams/class-structure.png)

### Behaviour — list and filter events

The handler orders upcoming events soonest first and applies the city filter on the server. The page shows an empty state when nothing matches and marks cancelled events (`L2-021`).

![Sequence diagram: list and filter events](diagrams/sequence-list-events.png)
