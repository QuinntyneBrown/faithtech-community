# 0016. Notifications, announcements and search: the open questions

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-026, L2-027, L2-028, L2-029, L2-030, L2-042
- Designs: `docs/detailed-designs/notifications/*`, `docs/detailed-designs/announcements/*`, `docs/detailed-designs/search/global-search`

## Context

The notifications, announcements and search designs left several points `<TO SUPPLY>`: how the unread count refreshes, the unsubscribe token's lifetime and landing page, whether a large announcement fans out in a background job, and the per-group search limit. Building them also raised questions the designs did not ask: where the bell's glue lives, who a notice's avatar shows, how full-text search can be tested without PostgreSQL, and what System Admin sees in search.

## Decision

Notifications

- The bell's glue lives in the app shell (`ShellNotificationsComponent` in `shell/`), not in the `notifications` library: the shell must not import a feature library eagerly, so it composes `NotificationBellComponent` and `NotificationPanelComponent` from `components` with `NOTIFICATIONS_SERVICE` from `api`. The `notifications` library holds only the notifications and settings pages. The panel and the page list notices with one new `NoticeListComponent` in `components`, which can hold a link's navigation back until the notice is marked read.
- The unread count and the panel's latest notices load when the shell opens, on every navigation and every 60 seconds while the tab is visible. Server push (SignalR) is deferred.
- A notification may name an **actor**, the member whose action raised it. The list returns the actor's name and profile id so the notice shows their initials in the avatar colour from ADR 0008; without an actor it shows "FaithTech". The notice's whole title is the link to the related item.
- `GET /api/notifications` takes `unreadOnly` and `page` and returns 50 newest first with `totalCount`, `unreadCount` and `hasMore`. Marking read and "Mark all as read" only touch the caller's own notifications; anyone else's id answers `404`.
- Sources call `INotificationPublisher`: `Publish` adds one in-app notification (events use it for changes, cancellations and RSVP confirmations), and `PublishAsync` adds one per recipient and queues each recipient's email in the same unit of work (announcements use it). The triggers built before this feature (role changes, invites, contacts, Agile) keep their own notifiers, which already queue email through the outbox; moving them onto the publisher is a refactor left for later.

Email

- Every email has a plain-text part and an HTML part. `OutboxEmailQueue` renders the HTML from the text with `EmailTemplateRenderer` when the email is queued, using the design system's `.email` pattern with values read from `tokens.css`, which the Infrastructure assembly embeds at build time. Links are absolute URLs on `WebApp:Origin`; the API refuses to start outside Development when that origin is not HTTPS, so every link in a sent email uses HTTPS.
- The outbox, its 10-second poll and its retry budget of 5 attempts in all are the ones already built for identity email (L2-047).
- The only email a member can turn off is the announcement email (`Profile.AnnouncementEmailsOptedOut`).

Announcements

- An announcement is sent in one request: it stores the announcement, one `AnnouncementRecipient` and one notification per recipient, and queues one outbox email per recipient who has not opted out, in one save. The emails go out through the outbox worker, so the request never waits on the email provider. A background fan-out job is deferred until audiences outgrow one request.
- The audience resolves to members with a profile and an account who are not suspended. The sender receives the announcement when they are in the audience.
- `POST /api/announcements` answers `201` with the recipient count and how many will get an email, which the success state shows.
- The announcements page lists the announcements sent to the caller and every announcement the caller sent, 25 at a time. Communications Leads and System Admins see the **New announcement** button; anyone else who opens the compose route is sent to the forbidden page, and the API answers `403`.
- Roles are chosen with a checkbox group (L2-029 says one or more roles); the compose mock is updated to match. The event RSVP audience lists upcoming events and counts members who RSVP'd; guest RSVPs have no account and get nothing.

Unsubscribe

- The email's unsubscribe link opens `/unsubscribe?token=…` in the web app, an anonymous page in the `announcements` library (new mock `pages/unsubscribe`: default, success, error). The page posts the token to `POST /api/announcements/unsubscribe`, the only anonymous endpoint these features add. A `GET` never changes anything, so link scanners in mail clients cannot unsubscribe anyone.
- The token is an ASP.NET Data Protection payload with its own purpose string, holding only the profile id, time-limited to **one year**. It can do nothing but set the opt-out. An invalid, tampered or expired token answers `400` and the page shows the error state, which points to Settings.
- Settings gets an **Email me when** card with the "Email me announcements" switch. It saves when it is flipped, as the theme does, and reads the current value from `GET /api/me/announcement-email-opt-out`. The settings mock's account card and Save button stay for the account settings design (L2-052).

Search

- `GlobalSearchHandler` in Application asks one `ISearchSource` per result kind (people, events, partners, contacts, work items). Each source builds a query that is already filtered by what the caller may open, so permissions are applied by the same code in production and in tests. A later feature adds a kind by registering a source.
- Text matching sits behind `IFullTextSearch`. `PostgresFullTextSearch` in Infrastructure matches a generated, GIN-indexed `tsvector` column (`SearchVector`, `to_tsvector('english', …)`) on each searchable table and orders by `ts_rank`. The term becomes a prefix query of its words (`to_tsquery('english', 'gra:* & she:*')`) rather than `websearch_to_tsquery`, so a partly typed name still matches; only letters and digits pass into the query. Backend tests use an in-memory implementation that matches the same fields case-insensitively, because the EF Core in-memory provider cannot run PostgreSQL text search. The columns are configured only for PostgreSQL.
- Who sees what: people and events, every signed-in member; partners, lead roles, Staff and System Admin; contacts, only the caller's own active contacts, System Admin included (as ADR 0014 decides for the contacts list); work items, members and owners of the workspace, Staff and System Admin. Suspended members, archived contacts and archived workspaces and work items never appear.
- Each group returns at most **10** results, best match first. Terms are trimmed; under 2 characters the API answers `400` and the page shows the hint without calling it.
- The 500 ms p95 target (L2-026 AC5) needs PostgreSQL, so it is not part of the backend test run. `eng/load-test.js` checks it (`kind:search`, p95 under 500 ms) in the isolated performance environment after `seed-search-records 100000`, a new idempotent CLI command that adds 100,000 searchable events. Contact notes are not searched yet: a generated column cannot read another table.

## Consequences

- The shell polls a small endpoint once a minute per open tab. That is cheap, and push can replace it without changing the components.
- Announcement sends to very large audiences make one long request; the outbox keeps email delivery out of it.
- A forwarded announcement email lets whoever holds it turn off that member's announcement emails, and nothing else. The member can turn them back on in Settings.
- Search permission tests exercise the real filters; only the text match differs between the test and production implementations.
- Unsubscribe tokens last a year, so the Data Protection key ring must persist across deployments and be shared by every API instance. Configuring that persistence belongs to the deployment work (`backend/deploy/`, `eng/infra/`); until then a redeploy that loses the keys makes older unsubscribe links show the error page, which points to Settings.

## Deferred

- Server push (SignalR) for the unread count; the shell polls once a minute.
- `Invite` has no in-app form, because an invitee has no account; the invite email is sent by the invites feature.
- Role changes, invites, contacts and Agile keep their own notifiers and plain-text emails (which still get the rendered HTML part through the outbox); moving them onto `INotificationPublisher.PublishAsync`, and per-kind email templates, are later refactors.
- A background fan-out job for very large announcement audiences.
- Searching contact notes, and a measured search p95 on PostgreSQL with 100,000 records (the load test and `seed-search-records` are ready).

