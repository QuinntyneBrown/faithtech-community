# In-app notifications

## Overview

FaithTech Community tells members about activity that concerns them. A *notification* is a short record addressed to one member that describes something that happened, such as a contact signing up or an event being cancelled, and links to the related item. This feature covers the in-app channel: the bell in the app shell, its panel, and the notifications page. The email channel is described in the email notifications design (`L2-028`).

- **notification** — record addressed to one recipient that names an occurrence and links to the item it concerns
- **unread count** — number of the recipient's notifications that have no read time
- **bell** — app-shell control that shows the unread count and opens the notification panel

Other features create notifications through one Application service, so every source produces the same record. A notification belongs only to its recipient; no other member, including Staff, reads it.

## Description

- **`NotificationBellComponent`** and **`NotificationPanelComponent`** — component in the `components` library that renders the bell button (a `<button aria-haspopup="dialog">`, never a link, with `aria-expanded` and, while open, `aria-controls` naming the panel), the unread badge and the panel shell. It receives items and the count through inputs and emits `open` and `markAllRead` events; it makes no HTTP calls.
- **`NotificationsPage`** — page in the `notifications` feature library (mock `pages/notifications`). It lists notifications newest first, 50 at a time with a **Show older notifications** button, filters to **All** or **Unread** (mock `pages/notifications/unread`), shows the empty state when none exist, and offers "Mark all as read".
- **`AppShellComponent`** bell glue — the app shell composes the bell and panel with `NotificationsService` (ADR 0015). It is not in the `notifications` library, because the shell never imports a feature library eagerly.
- **`NotificationsService`** / **`NOTIFICATIONS_SERVICE`** / **`HttpNotificationsService`** — API client contract, injection token and HTTP implementation in the `api` library.
- **`NotificationsEndpoints`** — minimal API mapping in `FaithTech.Community.Api` for `GET /api/notifications?unreadOnly=&page=`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read` and `POST /api/notifications/read-all`. Another member's notification id answers `404`.
- **`ListNotificationsQuery`** / **`ListNotificationsHandler`** — returns a page of 50 of the caller's notifications ordered by `CreatedAt` descending, filtered by recipient (and, with `unreadOnly`, by a null `ReadAt`) in the database query.
- **`MarkNotificationReadCommand`** / **`MarkNotificationReadHandler`** and **`MarkAllNotificationsReadCommand`** / **`MarkAllNotificationsReadHandler`** — set `ReadAt` on one or all of the caller's unread notifications.
- **`INotificationPublisher`** — Application service other features call to create a notification and, when the notification kind has an email form, enqueue the email.
- **`Notification`** — Domain entity with `RecipientId`, `Kind`, `Title` (required), `LinkPath` (required), an optional `ActorId` (the member whose action raised it; the notice shows their initials), `CreatedAt` and `ReadAt`. `MarkRead(at)` keeps the first read time.
- **`NotificationKind`** — enumeration of notification sources, listed in `L2-028`.
- **`CommunityDbContext`** — persists `Notification` rows in the `notifications` table.

The shell reloads the unread count and the panel's latest notices on every navigation and every 60 seconds while the tab is visible; server push is deferred (ADR 0015).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-027` | `L1-010` | In-app notifications |

### Acceptance criteria

**`L2-027` — In-app notifications**

1. Given a new notification, when the user is signed in, then the bell shows an unread count, and the panel lists notifications newest first.
2. Given the panel, when the user opens a notification, then it is marked read and they are taken to the related item.
3. Given unread notifications, when the user chooses "Mark all as read", then the count clears.
4. Given the notifications page, when there are none, then an empty state is shown.
5. Given the notifications page, when the user chooses "Unread", then only unread notifications are listed, and "All" lists every notification again.
6. Given more than 50 notifications, when the page loads, then the newest 50 are listed with "Show older notifications", which appends the next 50 and disappears when none are left.

## Diagrams

### System context

A member reads notifications that FaithTech Community creates about activity that concerns the member.

![C4 system context for in-app notifications](diagrams/c4-context.png)

### Containers

The bell and the notifications page live in the web app, which calls the Community API; the API stores notifications in the Community database.

![C4 container view for in-app notifications](diagrams/c4-container.png)

### Components

`NotificationsEndpoints` dispatches queries and commands to handlers, which scope every read and write to the caller through `ICurrentUser`. Other features write notifications through `INotificationPublisher`.

![C4 component view for in-app notifications](diagrams/c4-component.png)

### Class structure

`Notification` carries a `NotificationKind` and an optional `ReadAt`. The handlers depend on `ICurrentUser` to restrict each operation to the recipient.

![Class diagram for in-app notifications](diagrams/class-structure.png)

### Behaviour — open a notification

The panel lists notifications newest first (`L2-027`). Opening one marks it read and navigates to its `LinkPath`.

![Sequence diagram for open a notification](diagrams/sequence-open-notification.png)

### Behaviour — mark all as read

"Mark all as read" sets `ReadAt` on every unread notification of the caller in one statement, and the badge clears (`L2-027`). An empty result shows the empty state.

![Sequence diagram for mark all as read](diagrams/sequence-mark-all-read.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `NotificationKind` adds `InviteAccepted` (inviter notified, `L2-011` AC4) and `WorkspaceOwnerLostCityLead` (System Admin notified, `L2-037` AC2), which are in-app occurrences not listed in `L2-028`.
