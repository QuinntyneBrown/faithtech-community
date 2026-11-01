# 0036. Event hubs are children of events, stored as sections and read live from the event

- Status: Accepted
- Date: 2026-11-01
- Requirements: L1-008, L2-153 to L2-155, L2-135 AC1, L2-151 AC2
- Designs: `docs/detailed-designs/events/create-event-hub`
- Proposal: `docs/proposals/event-hubs.md`
- Refines: ADR 0032 (organisation per host), ADR 0033 (capabilities), ADR 0034 (chapters are tags)

## Context

Chapters want participant hubs like the hand-made SoCal Hackathon page, built by answering short wizards. Slice 41 lays the
foundations every later hub slice uses: the records, the capability, the API shape, how the hub relates to its event and how
"never retype what the system knows" is kept.

## Decision

- **Part of `events`, not a subsystem.** `EventHub` and `HubSection` live in `Domain/Events/`, their handlers in
  `Application/Events/`, the wizard and hub home in `frontend/projects/events/`. Both entities implement `IOrganisationScoped`, so
  the DbContext stamps them and filters them on the current organisation; another organisation's hub is not found (404).
- **One hub per event**, enforced by a unique index on `(OrganisationId, EventId)` and by the create handler (409). The hub is
  addressed through its event (`/api/events/{eventId}/hub`), never by its own id, so the URL needs no second lookup and a hub
  cannot be reached apart from its event.
- **Sections are rows, content is JSON.** `HubSection` has `Kind` (an enumeration stored as text), `Order`, `Visible` and
  `Content` (a JSON document, `{}` until its wizard fills it). Each kind's schema is validated in Application by later slices.
  A hub is created with one section per kind of the phase 1 catalogue, all visible; a kind added later is added to existing hubs
  hidden by that slice's migration.
- **Facts are read, never copied.** The hub stores no title, date, venue, time zone or RSVP link. `GetEventHub` reads them from
  the event on every request, so editing the event updates the hub. Events carry no time zone today, so times are shown in the
  viewer's time zone, as the event page does; a per-event time zone is deferred to the agenda's live highlight (slice 42/44).
- **Section state is computed, not stored.** Hidden when not visible; Ready for the kinds the system fills (Hero, Giving,
  Upcoming events, and Venue when the event is in person with a venue); otherwise Needs info. Later slices make a kind Ready once
  its content is complete.
- **Capability `ManageEventHubs`**, separate from `ManageEvents` so an organisation can let someone build hubs without editing
  events. FaithTech grants it to City Lead and Event Lead through the seed and, for existing databases, a migration that appends
  it to those two definitions only when missing. `AdministerOrganisation` overrides, audited (`event_hub.created`,
  `event_hub.updated`).
- **Chapter-tagged holders manage every chapter's hubs** (proposal open question 1): chapters tag and filter and never hide.
- **The hub's link** is `/public/events/{eventId}/hub`, beside the public event page; the page itself arrives with slice 44, which
  owns its visibility rules.
- **Autosave through one PUT.** The wizard creates the hub when step 1 is passed and saves the starting point and section
  visibility with `PUT /api/events/{eventId}/hub` on every Next and on Save and finish later. A kind left out of the request keeps
  its visibility, so a later wizard can save part of the hub.

Rejected: a hub id in the URL (a second identifier for the same thing); copying the event's facts into the hub (stale after every
edit, breaks design rule 4); reusing `ManageEvents` (an organisation could not separate the two jobs); a stored section state
(drifts from the content).

## Consequences

- `EventDetailDto` gains `HubId` and `CanManageHub`, so the event page decides between Create and Open without a second call.
- The capability catalogue grows to 20 entries; the catalogue and seed tests change with `L2-135` AC1 and `L2-151` AC2.
- `HubTemplate` (slice 45) adds rows keyed by `TemplateKey`; until then only `blank` is accepted.
