# Public events and guest RSVP

## Overview

Profiles and most content in FaithTech Community are visible to signed-in members only. Public events are the one exception: an anonymous visitor may open a public event's share link, read the event, RSVP as a guest and download its `.ics`.

Key terms:

- **public event** — event whose visibility is `Public`
- **share link** — stable URL of an event's public page
- **guest RSVP** — RSVP made with a name and email address, without creating an account

The anonymous endpoints are opted in explicitly. A members-only event requested anonymously redirects to sign-in. Guest RSVPs are rate limited per IP address and de-duplicated per email address.

## Description

- **`PublicEventPage`** — anonymous route in the `events` library (mock: `docs/mocks/pages/public-event/`, states `default`, `invalid`, `success`, `cancelled`, `error`). It shows the event and a guest RSVP form with name and email.
- **`EventsService` / `EVENTS_SERVICE`** — `getPublicEvent(id)` and `rsvpAsGuest(id, request)`, implemented by `HttpEventsService` without a bearer token.
- **`EventsEndpoints`** — maps `GET /api/public/events/{id}` and `POST /api/public/events/{id}/rsvps`, each with explicit `AllowAnonymous`. The guest RSVP endpoint applies the `guest-rsvp` rate-limit policy: 10 requests per IP address per hour (`L2-023`).
- **`GetPublicEventHandler`** — returns the event only when its visibility is `Public`; otherwise returns a not-public result that the web app turns into a sign-in redirect.
- **`GuestRsvpCommand` / `GuestRsvpValidator`** — name and email, with email format validation.
- **`GuestRsvpHandler`** — refuses cancelled events, keeps a single RSVP per event and normalized email, and sends the confirmation email with the `.ics`. No account is created.
- **`IIcsCalendarWriter`** and **`IEmailSender`** — Infrastructure services for the attachment and delivery.

Email normalization rules beyond case folding are `<TO SUPPLY>`.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-023` | `L1-008` | Public events and guest RSVP |

### Acceptance criteria

**`L2-023` — Public events and guest RSVP**

1. Given a public event, when an anonymous visitor opens its share link, then they see the event without signing in.
2. Given a guest, when they RSVP with a name and a valid email, then a confirmation email with the .ics is sent and no account is created.
3. Given a members-only event, when an anonymous visitor requests it, then they are redirected to sign in.
4. Given more than 10 guest RSVPs from one IP address in an hour, when another is submitted, then it is rejected.
5. Given the same email, when a guest RSVPs to the same event twice, then a single RSVP is kept.
6. Given a guest RSVP, when the guest follows the cancel link in their confirmation email, then their RSVP is cancelled without signing in.

## Diagrams

### System context

An anonymous visitor reaches a public event through its share link. Guest confirmations leave through the email provider.

![C4 system context for public events and guest RSVP](diagrams/c4-context.png)

### Containers

The `PublicEventPage` calls anonymous routes on the Community API without a bearer token.

![C4 container view for public events and guest RSVP](diagrams/c4-container.png)

### Components

`EventsEndpoints` opts the public routes into anonymous access and rate limiting. The handlers enforce visibility, de-duplication and confirmation.

![C4 component view for public events and guest RSVP](diagrams/c4-component.png)

### Class structure

`GuestRsvpHandler` creates `Rsvp` records with `IsGuest` set and no `ProfileId`. `PublicEventDto` exposes no RSVP data.

![Class diagram for public events and guest RSVP](diagrams/class-structure.png)

### Behaviour — open a public event share link

A public event renders without sign-in. A members-only event returns not-public, and the web app redirects to sign-in (`L2-023`).

![Sequence diagram: open a public event share link](diagrams/sequence-open-public-event.png)

### Behaviour — rSVP as a guest

The rate limiter rejects the eleventh guest RSVP from one IP address within an hour. A second RSVP with the same email keeps the single existing record (`L2-023`).

![Sequence diagram: rSVP as a guest](diagrams/sequence-guest-rsvp.png)
