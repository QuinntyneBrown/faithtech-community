# 0038. Hub section content is a typed schema per kind, holding only what the lead types

- Status: Accepted
- Date: 2026-11-01
- Requirements: L1-008, L2-156 to L2-162, L2-151 AC1
- Designs: `docs/detailed-designs/events/fill-in-hub-sections`
- Proposal: `docs/proposals/event-hubs.md`
- Refines: ADR 0036 (event hubs are children of events, stored as sections)

## Context

ADR 0036 stores each hub section's content as JSON and leaves its schema to the slice that fills it. Slice 42 fills the seven
phase 1 kinds. It has to decide what the JSON holds, where it is validated, how it is addressed, how times are kept when events
carry no time zone, where the organisation's giving link lives, and how much of the image work the proposal mentions belongs here.

## Decision

- **One content record per kind, validated in Application.** `HeroContent`, `AgendaContent`, `VenueContent`, `PeopleContent`,
  `LinksContent`, `GivingContent` and `UpcomingEventsContent` are records with a FluentValidation validator each. The save handler
  deserialises the request body into the kind's record, validates it, checks what needs the database (People profile ids belong to
  the organisation; a code freeze is an agenda row's time), and stores the record re-serialised, so `Content` only ever holds
  the known fields. Errors are keyed by field path (`items[2].title`) so the wizard shows them on the step that holds the field.
- **Content holds only what the lead types.** Values another feature owns are read live when the hub is read: the event's
  facts, the organisation's giving link and text, a member's name and featured photo (People stores only the profile id), and
  the upcoming events. A removed profile drops out of People on the next read.
- **One endpoint per section kind**, `PUT /api/events/{id}/hub/sections/{kind}`, replacing that section's content as a whole;
  ordering has its own endpoint, `PUT /api/events/{id}/hub/sections/order`, which needs every kind exactly once. Hide and show
  reuse slice 41's `PUT /api/events/{id}/hub`.
- **Agenda times are instants in the member's time zone.** Events carry no time zone, and every event time in the app is
  entered and shown in the member's time zone; agenda rows follow the same rule and are stored as `DateTimeOffset`. A pasted
  time without am or pm is read within the event's hours. Rows outside the event's start and end are a warning, not an error.
- **The giving link is organisation data.** `Organisation` gains `GivingLink` (https) and `GivingText`, edited on Organisation
  settings General and audited with the other settings. The FaithTech seed and a data migration set FaithTech's
  `https://faithtech.com/donate` (the link the SoCal hub used) and "Help us build the next one.". Giving is Ready only when the
  organisation has a giving link, which refines slice 41's "Giving is always Ready".
- **Images are deferred** to slice 46 (Slides), which needs a Resources image picker and upload anyway: the Hero cover image,
  the Venue photo and guest photos are not part of the phase 1 schemas yet. Guests show initials. The Hero shows the
  organisation's name until organisations have logos and events have linked partners.
- **Display components live in the `events` library**, one per kind, composed from `components` primitives. They are
  feature-specific renderings of hub data, reused by the section preview and the review steps now and by the preview route and
  public page later; their layouts are documented as the pattern `docs/design-system/patterns/event-hub-sections.html`.

## Consequences

- Adding a section kind means one record, one validator, one state rule, one wizard and one display component, with nothing to
  migrate: unknown fields are never stored, and a kind with no content yet reads as its defaults.
- Changing an event, a profile or the organisation's giving link changes every hub at once, with no copy to refresh.
- Agenda times move with the viewer's time zone, like every event time, until events gain a time zone (open for slice 44).
- Hubs have no pictures until slice 46.

## Alternatives considered

- **One generic `PUT` with all sections.** Rejected: every wizard would resend content it never showed, and one invalid section
  would block saving another.
- **Copying member names and photos into People.** Rejected: it breaks "never retype what the system knows" and leaves stale
  names after a profile changes.
- **A giving link per chapter or per event.** Rejected for now: the proposal fills Giving from the organisation; the event line
  covers event-specific wording.
