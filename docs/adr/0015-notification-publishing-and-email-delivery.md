# 0015. Notification publishing and email delivery

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-027, L2-028, L2-030
- Designs: `docs/detailed-designs/notifications/in-app-notifications`, `docs/detailed-designs/notifications/email-notifications`

## Context

The notification designs left the unread-count refresh, the outbox poll interval and backoff, and the retry limit open. They name an `IEmailQueue`, an `EmailTemplateRenderer` and a `NotificationsBellContainer` in the `notifications` library, while the code already queues every email through `IEmailSender` backed by an outbox (`OutboxEmailSender`, `EmailOutboxDispatcher`, `EmailOutboxWorker`), and `AGENTS.md` keeps feature libraries out of the app shell. Role changes and accepted invites already write `Notification` rows directly. Notifications carry no actor, while the bell and page mocks show the actor's initials.

## Decision

- **One publisher.** `INotificationPublisher` (Application, `Notifications/`) is the only way features raise notifications. `PublishAsync` takes the recipients' profile ids, the kind, a title, a link path, an optional actor name and an optional email (subject and plain-text body). It adds one `Notification` per recipient, saves, then queues the email for each recipient that has an address. For `NotificationKind.Announcement` it skips recipients whose `AnnouncementEmailsOptedOut` is set; every other kind always emails (L2-028 AC3). Role changes now go through it; the accepted-invite notification keeps its own write until the invites feature next changes.
- **`IEmailSender` is the queue.** There is no separate `IEmailQueue`: `IEmailSender.SendAsync` already writes an outbox row, so the triggering action commits while the provider is down. Tests replace it with a fake.
- **Delivery.** Unchanged from the outbox already on `main`: the worker polls every 10 seconds (`Outbox:IntervalSeconds`), so a queued email leaves within 2 minutes, and a failing email gets 5 attempts in all (`EmailOutboxDispatcher.MaxAttempts`) before it is marked `FailedAt` (see the email notifications design).
- **Parts and links.** Bodies are written as plain text. The SMTP transport sends `multipart/alternative` with that text as the `text/plain` part and an HTML part derived from it (escaped, paragraphs, links made clickable). Branded HTML templates (`docs/mocks/notifications/email`) are deferred. Every link is built from `WebApp:Origin`, and startup fails unless that origin is `https`, except `localhost` and `127.0.0.1` for local development (L2-028 AC2).
- **Actor.** `Notification` gains an optional `ActorName`, shown as the avatar's initials; system notices without one show "FaithTech".
- **Bell in the shell.** `AppShellComponent` renders `NotificationBellComponent` and `NotificationPanelComponent` from `components` and talks to `NOTIFICATIONS_SERVICE` from `api`. It reads the unread count on load, after every navigation and every 60 seconds while the tab is visible, and loads the latest five when the panel opens. Server push is deferred. The `notifications` library holds only the notifications page.
- **API.** `GET /api/notifications?page=&unreadOnly=` returns `{ items, unreadCount, page, pageSize, totalCount }`, 50 per page, newest first; `unreadOnly` lists only unread ones (L2-027 AC5, AC6). `GET /api/notifications/unread-count` returns `{ count }`. `POST /api/notifications/{id}/read` and `POST /api/notifications/read-all` answer `204`. Another member's notification answers `404`, so ids do not leak.

## Consequences

- Features that arrive later (contacts, events, Agile) call `INotificationPublisher` and get both channels and the opt-out rule for free.
- A large announcement queues one outbox row per recipient in the request; moving the fan-out to a background job is deferred until audiences outgrow it.
- A permanently failed email stays in the outbox for diagnosis; there is no alert yet.
