# Send an announcement

## Overview

An *announcement* is a message with a subject and a body that a Communications Lead or System Admin sends to a chosen audience. Announcements are the broadcast channel of FaithTech Community, distinct from notifications that the system raises automatically.

- **audience** — set of recipients chosen at compose time: everyone, the holders of one role, or the RSVP list of one event
- **recipient count** — number of members the chosen audience resolves to at the moment of preview

Each recipient receives an in-app notification and, unless the recipient opted out of announcement emails, an email. Delivery reuses the notifications pipeline described in the in-app and email notification designs. The compose screen is the `compose-announcement` mock.

## Description

- **`ComposeAnnouncementPage`** — page in the `announcements` feature library (mock `pages/compose-announcement`). It collects subject, body and audience, shows the recipient count, and shows inline field errors.
- **`AnnouncementsService`** / **`ANNOUNCEMENTS_SERVICE`** / **`HttpAnnouncementsService`** — API client contract, token and HTTP implementation in the `api` library.
- **`AnnouncementsEndpoints`** — minimal API mapping for `POST /announcements/recipient-count` and `POST /announcements`.
- **`CountAnnouncementRecipientsQuery`** / **`CountAnnouncementRecipientsHandler`** — resolves an `AnnouncementAudience` to a count in the database.
- **`SendAnnouncementCommand`** / **`SendAnnouncementHandler`** / **`SendAnnouncementValidator`** — validates subject and body, checks the caller holds `CommunicationsLead` or `SystemAdmin`, stores the `Announcement`, resolves recipients, and publishes one notification per recipient.
- **`AnnouncementAudience`** — value object with `Kind` (`Everyone`, `Role`, `EventRsvps`) and an optional `Role` or `EventId`.
- **`Announcement`** — Domain entity with `Subject`, `Body`, `Audience`, `SenderId` and `SentAt`, plus `AnnouncementRecipient` rows that record who received it.
- **`INotificationPublisher`** — creates the in-app notification and enqueues the email, honouring the opt-out (`L2-028`).

Sends to large audiences run in one request; whether delivery fans out in a background job is `<TO SUPPLY>`.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-029` | `L1-011` | Compose and send announcements |

### Acceptance criteria

**`L2-029` — Compose and send announcements**

1. Given a Communications Lead or System Admin, when they send an announcement with a subject and body to everyone, the holders of one role, or one event's RSVP list, then each recipient gets an in-app notification and, unless opted out, an email.
2. Given an empty subject or body, when they send, then inline errors are shown.
3. Given any other user, when they call the send API, then the response is 403.
4. Given the compose page, when the audience is chosen, then the number of recipients is shown before sending.

## Diagrams

### System context

A Communications Lead sends announcements through FaithTech Community, which delivers email through the email provider.

![C4 system context for send an announcement](diagrams/c4-context.png)

### Containers

The compose page in the web app calls the Community API, which stores the announcement and enqueues email for delivery.

![C4 container view for send an announcement](diagrams/c4-container.png)

### Components

`AnnouncementsEndpoints` validates the command and dispatches it. `SendAnnouncementHandler` authorizes the caller, stores the announcement and publishes through `INotificationPublisher`.

![C4 component view for send an announcement](diagrams/c4-component.png)

### Class structure

`Announcement` composes an `AnnouncementAudience` and its `AnnouncementRecipient` rows. The handler depends on `ICurrentUser` for the role check.

![Class diagram for send an announcement](diagrams/class-structure.png)

### Behaviour — send an announcement

The page previews the recipient count, then sends. Validation failures return 400, and callers without the Communications Lead or System Admin role receive 403 (`L2-029`).

![Sequence diagram for send an announcement](diagrams/sequence-send-announcement.png)
