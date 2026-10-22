# RSVP

## Overview

An *RSVP* is a member's or guest's statement that they will attend an event. This feature covers a signed-in member RSVPing to an open event, cancelling that RSVP, and who sees which RSVP details on the event page.

Key terms:

- **open event** — event that is not cancelled
- **RSVP list** — names of everyone who RSVP'd to an event
- **attendee** — signed-in member who holds no lead role and is not Staff

Attendees see only the RSVP count. Leads, Staff and System Admin see the full RSVP list. Guest emails are shown to leads and System Admin only, because Staff is read-only and guest emails are personal data. Guest RSVPs are covered by the public-events-and-guest-rsvp feature.

## Description

- **`EventPage`** — routed event detail page in the `events` library (mock: `docs/mocks/pages/event/`, states `default`, `rsvped`, `lead`, `cancelled`). It offers RSVP and cancel-RSVP actions and renders either the RSVP count or the RSVP list.
- **`CancelRsvpDialog`** — Angular CDK Dialog in the `events` library (mock: `docs/mocks/dialogs/cancel-rsvp/`) that confirms cancellation with a safe *Keep my RSVP* button and a danger *Cancel my RSVP* button.
- **`EventsService` / `EVENTS_SERVICE`** — `getEvent(id)`, `rsvp(id)` and `cancelRsvp(id)`, implemented by `HttpEventsService`.
- **`EventsEndpoints`** — maps `GET /api/events/{id}`, `POST /api/events/{id}/rsvps` and `DELETE /api/events/{id}/rsvps/me`.
- **`GetEventHandler`** — returns `EventDetailDto`. It includes `Rsvps` only when `EventPermissions.CanSeeRsvpList` is true, and includes guest emails only when `CanSeeGuestEmails` is true (`L2-022`).
- **`RsvpToEventHandler`** — calls `Event.Rsvp(profileId, now)`, which refuses a cancelled, full or already-started event and returns the existing `Rsvp` when the member already RSVP'd; the handler then records an in-app confirmation and queues a confirmation email with the `.ics` attached.
- **`CancelRsvpHandler`** — calls `Event.CancelRsvp(profileId)` to remove the caller's `Rsvp`.
- **`IIcsCalendarWriter`** — Infrastructure service that writes the `.ics` attachment (see calendar-export).
- **`IEmailSender`** — Infrastructure email service that sends through SMTP/SendGrid.
- **`INotificationPublisher`** — records the in-app confirmation.

An event may have an optional capacity (`L2-020` AC5); `Event.IsFull` refuses RSVPs once it is reached.

Since [event check-in](../event-check-in/README.md), an `Rsvp` row also records a check-in (`CheckedInAt`, `CheckedInById`) and may be a walk-in added at the door (`IsWalkIn`, [ADR 0029](../../../adr/0029-check-in-storage-on-the-rsvp.md)). `RsvpCount`, `IsFull`, the RSVP list on the event page and the RSVP CSV leave walk-ins out, so this feature's behaviour is unchanged. Leads, Staff and System Admin also see "{n} checked in" beside the RSVP count once anyone is checked in (`L2-121`).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-022` | `L1-008` | RSVP |

### Acceptance criteria

**`L2-022` — RSVP**

1. Given a signed-in member and an open event, when they RSVP, then they receive an in-app and email confirmation with the .ics attached.
2. Given an RSVP, when the member cancels it after confirming, then they are removed from the list and can RSVP again any time before the event.
3. Given an attendee who is not a lead or Staff, when they view an event, then they see only the RSVP count.
4. Given a lead, Staff or System Admin, when they view an event, then they see the full RSVP list. Guest emails are shown to leads and System Admin only.
5. Given a lead or System Admin, when they choose "Export CSV" on the RSVP list, then a CSV of the list is downloaded.

## Diagrams

### System context

Members RSVP to events; leads and Staff view RSVP lists. Confirmation emails leave through the email provider.

![C4 system context for rSVP](diagrams/c4-context.png)

### Containers

The `EventPage` calls the Community API. The API stores RSVPs in the Community database and sends confirmations through the email provider.

![C4 container view for rSVP](diagrams/c4-container.png)

### Components

`GetEventHandler` filters RSVP data through `EventPermissions`. `RsvpToEventHandler` writes the RSVP, records the in-app confirmation and emails the `.ics`.

![C4 component view for rSVP](diagrams/c4-component.png)

### Class structure

`Event` composes `Rsvp` records. `EventDetailDto.Rsvps` is null for callers who may see only the count, and `RsvpDto.GuestEmail` is null unless the caller may see guest emails.

![Class diagram for rSVP](diagrams/class-structure.png)

### Behaviour — rSVP to an event

The handler refuses cancelled events, records the RSVP once per member, and sends an in-app and email confirmation with the `.ics` attached (`L2-022`).

![Sequence diagram: rSVP to an event](diagrams/sequence-rsvp.png)

### Behaviour — cancel an RSVP

The member confirms in `CancelRsvpDialog` before the RSVP is removed from the list (`L2-022`).

![Sequence diagram: cancel an RSVP](diagrams/sequence-cancel-rsvp.png)

### Behaviour — view RSVP details by role

The server decides what RSVP data leaves the API. Attendees receive only the count; leads, Staff and System Admin receive the list; guest emails reach leads and System Admin only (`L2-022`).

![Sequence diagram: view RSVP details by role](diagrams/sequence-view-rsvps.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- Capacity was an open question; `L2-020` AC5 defines it, so `Event` enforces it. RSVPs are also refused once the event has started, matching "any time before the event" in `L2-022` AC2. Resolved.
- Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.

Decisions recorded while building the slice:

- `POST /api/events/{id}/rsvps` answers 204 and is idempotent: a second RSVP keeps the one RSVP and sends no second confirmation. A cancelled, started or full event answers 409 with "This event was cancelled.", "This event has already started." or "This event is full." (`L2-020` AC5), which the page shows. `DELETE /api/events/{id}/rsvps/me` answers 204, or 404 when the caller has no RSVP; the dialog treats 404 as done.
- The confirmation is an `RsvpConfirmed` in-app notification through `INotificationPublisher` (the notifications seam) and an email with the `.ics` from `IIcsCalendarWriter` attached. `EmailMessage` gained attachments, which `OutboxMessage.AttachmentsJson` keeps until the outbox sends them, and the SMTP transport attaches them.
- "Lead" means City Lead, Event Lead, Create Lead or Communications Lead. Leads, Staff and System Admins get `rsvps` on `EventDetailDto`, newest first; guest emails are filled in for leads and System Admins only, and `canExportRsvps` is true for them. Everyone else gets `rsvps: null` and the count.
- `GET /api/events/{id}/rsvps.csv` (leads and System Admins; Staff and attendees 403) has the columns Name, Member or guest, Guest email and RSVP'd (UTC); cells that could start a spreadsheet formula are prefixed with an apostrophe. The file is `{event-slug}-rsvps.csv`.
- The page names the host with their event role ("Marcus Lee, Event Lead"), shows a full event as full instead of offering RSVP, and after a refusal shows "You’re not on the list" with the server's reason. Cancelling an RSVP shows a success toast, "Your RSVP is cancelled". The Add to calendar link (calendar-export), the public page card (public-events-and-guest-rsvp) and Cancel event (cancel-events) arrive with their slices.

Decisions recorded with event check-in ([ADR 0029](../../../adr/0029-check-in-storage-on-the-rsvp.md)):

- Walk-ins are `Rsvp` rows with `IsWalkIn` set. They skip the capacity and has-started rules, and every RSVP count, the RSVP list and the RSVP CSV exclude them.
- The RSVP CSV writes through the shared `ICsvWriter` (`Application/Common`, `Infrastructure/Csv/CsvWriter.cs`), which applies the same quoting and apostrophe guard as the former private `Cell` method; the file's bytes are unchanged, as `RsvpTests` prove.
