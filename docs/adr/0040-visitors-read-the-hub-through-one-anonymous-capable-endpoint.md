# 0040. Visitors read the hub through one anonymous-capable endpoint, and the live agenda compares instants

- Status: Accepted
- Date: 2026-11-01
- Requirements: L1-008, L2-166 to L2-168
- Designs: `docs/detailed-designs/events/visit-event-hub`
- Proposal: `docs/proposals/event-hubs.md`
- Refines: ADR 0036 (event hubs are children of events), ADR 0038 (agenda times), ADR 0039 (the preview is the public route)

## Context

Slice 43 put the hub page at `/public/events/:id/hub` and read it through the manager endpoint, so only hub managers could
open it. Slice 44 opens it to visitors: anyone on a public event, signed-in members on a members-only event. Three things had
to be settled: where the read lives so the server can tell a member from an anonymous visitor, what the read may return, and
whose time zone the agenda's "happening now" follows when events carry no time zone (deferred here by ADR 0036 and ADR 0038).

## Decision

- **One page read, anonymous allowed, outside `/api/public/`.** `GET /api/events/{id}/hub/page` sits in the authenticated
  events group with an explicit `.AllowAnonymous()`. The app sends a member's token only to non-public API paths, so a read under
  `/api/public/` could never tell a member from a visitor; this path gets the token when there is one and works without it.
- **The server decides, and refuses with 404.** A holder of `ManageEventHubs` reads any hub (the preview). Anyone else reads only a
  Published hub, and on a members-only event only as a signed-in member of the organisation. Everything else, including a Draft
  hub and another organisation's event, is 404, never 403, so a hub's existence is not revealed.
- **The read returns only what a visitor sees.** Only shown sections are sent, so hidden or unfinished content never leaves the
  server. People carry no profile id for anonymous callers, because profiles are for signed-in members only; the name, photo,
  line and role the lead chose to show are published content.
- **The live agenda compares instants.** A row runs from its time to the next row's time, the last row to the event's end, and
  "happening now" is the row whose span holds the current instant. That instant is the same everywhere, so the highlight is right
  in every time zone without an event time zone. Times keep showing in the visitor's time zone, like every event time.
- **Link, don't embed.** The public event page and the member's event page show **Open the event hub** when the hub is published.
  The guest RSVP and the `.ics` stay on the public event page; the hub's RSVP button links back to it.

## Consequences

- The visibility rules live in one Application method and are proven by integration tests for every combination of public or
  members-only event, Draft or Published hub, anonymous, member or manager, and organisation.
- The manager read (`GET /api/events/{id}/hub`) is unchanged and still powers the hub home.
- A visitor in another time zone sees the right session highlighted, but its times in their own zone. A per-event time zone stays
  deferred; it would change how times read, not which session is live.

## Alternatives considered

- **A read under `/api/public/events/{id}/hub`.** Rejected: the token is never sent there, so members could not read members-only
  hubs without changing the interceptor's rule for every public path.
- **Returning every section and hiding the rest in the UI.** Rejected: AGENTS.md forbids relying on the UI to hide data.
- **Adding a time zone to events now.** Rejected for this slice: it changes the event form, the event page and every time shown,
  and is not needed to find the session in progress.
- **Embedding the hub in the public event page.** Rejected: two jobs on one page, and the hub would load for every RSVP.
