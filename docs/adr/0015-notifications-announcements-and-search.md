# 0015. Notifications, announcements and search: the open questions

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-026, L2-027, L2-028, L2-029, L2-030, L2-042
- Designs: `docs/detailed-designs/notifications/*`, `docs/detailed-designs/announcements/*`, `docs/detailed-designs/search/global-search`

## Context

The notifications, announcements and search designs left several points `<TO SUPPLY>`: how the unread count refreshes, the unsubscribe token's lifetime and landing page, whether a large announcement fans out in a background job, and the per-group search limit. Building them also raised questions the designs did not ask: where the bell's glue lives, who a notice's avatar shows, how full-text search can be tested without PostgreSQL, and what System Admin sees in search.

## Decision

Notifications

- The bell's glue lives in the app shell (`AppShellComponent`), not in the `notifications` library: the shell must not import a feature library eagerly, so it composes `NotificationBellComponent` and `NotificationPanelComponent` from `components` with `NOTIFICATIONS_SERVICE` from `api`. The `notifications` library holds only the notifications and settings pages.
- The unread count and the panel's latest notices load when the shell opens, on every navigation and every 60 seconds while the tab is visible. Server push (SignalR) is deferred.
- A notification may name an **actor**, the member whose action raised it. The list returns the actor's name and profile id so the notice shows their initials in the avatar colour from ADR 0008; without an actor it shows "FaithTech". The notice's whole title is the link to the related item.
- `GET /api/notifications` takes `unreadOnly` and `page` and returns 50 newest first with `totalCount`, `unreadCount` and `hasMore`. Marking read and "Mark all as read" only touch the caller's own notifications; anyone else's id answers `404`.
- New sources call `INotificationPublisher`, which adds the in-app notification and, when an email is given, queues the email. The triggers built before this feature (role changes, invites, contacts, Agile) keep their own notifiers, which already queue email through the outbox; moving them onto the publisher is a refactor left for later.

Email

- Every email has a plain-text part and an HTML part, rendered by `EmailTemplateRenderer` from the light-theme tokens. Links are absolute URLs on `WebApp:Origin`; the API refuses to start outside Development when that origin is not HTTPS, so every link in a sent email uses HTTPS.
- The outbox, its 10-second poll and its retry budget of 5 attempts in all are the ones already built for identity email (L2-047).
- The only email a member can turn off is the announcement email (`Profile.AnnouncementEmailsOptedOut`).

Announcements

- An announcement is sent in one request: it stores the announcement, one `AnnouncementRecipient` and one notification per recipient, and queues one outbox email per recipient who has not opted out, in one save. The emails go out through the outbox worker, so the request never waits on the email provider. A background fan-out job is deferred until audiences outgrow one request.
- The audience resolves to members with a profile and an account who are not suspended. The sender receives the announcement when they are in the audience.
- `POST /api/announcements` answers `201` with the recipient count and how many will get an email, which the success state shows.
- The announcements page lists the announcements sent to the caller. Communications Leads and System Admins also see every announcement they sent and the **New announcement** button; the compose route answers the forbidden state for anyone else, and the API answers `403`.
- Roles are chosen with a checkbox group (L2-029 says one or more roles); the compose mock is updated to match. The event RSVP audience lists upcoming events and counts members who RSVP'd; guest RSVPs have no account and get nothing.

Unsubscribe

- The email's unsubscribe link opens `/unsubscribe?token=…` in the web app, an anonymous page in the `announcements` library (new mock `pages/unsubscribe`: default, success, error). The page posts the token to `POST /api/announcements/unsubscribe`, the only anonymous endpoint these features add. A `GET` never changes anything, so link scanners in mail clients cannot unsubscribe anyone.
- The token is an ASP.NET Data Protection payload with its own purpose string, holding only the profile id, time-limited to **one year**. It can do nothing but set the opt-out. An invalid, tampered or expired token answers `400` and the page shows the error state, which points to Settings.
- Settings gets an **Email me when** card with the "Email me announcements" switch. It saves when it is flipped, as the theme does, and reads the current value from `GET /api/me/announcement-email-opt-out`. The settings mock's account card and Save button stay for the account settings design (L2-052).

Search

- `GlobalSearchHandler` in Application asks one `ISearchSource` per result kind (people, events, partners, contacts, work items). Each source builds a query that is already filtered by what the caller may open, so permissions are applied by the same code in production and in tests. A later feature adds a kind by adding a source.
- Text matching sits behind `IFullTextSearch`. `PostgresFullTextSearch` in Infrastructure matches a generated, GIN-indexed `tsvector` column (`SearchVector`) on each searchable table with `websearch_to_tsquery('english', …)` and orders by `ts_rank`. Backend tests use an in-memory implementation that matches the same fields case-insensitively, because the EF Core in-memory provider cannot run PostgreSQL text search.
- Who sees what: people and events, every signed-in member; partners, lead roles, Staff and System Admin; contacts, only the caller's own active contacts, System Admin included (as ADR 0014 decides for the contacts list); work items, members and owners of the workspace, Staff and System Admin. Suspended members, archived contacts and archived workspaces and work items never appear.
- Each group returns at most **10** results, best match first. Terms are trimmed; under 2 characters the API answers `400` and the page shows the hint without calling it.
- The 500 ms p95 target (L2-026 AC5) needs PostgreSQL, so it is not part of the backend test run. It is checked with `eng/load-test.js` against a stack seeded with 100,000 records, as the performance design describes.

## Consequences

- The shell polls a small endpoint once a minute per open tab. That is cheap, and push can replace it without changing the components.
- Announcement sends to very large audiences make one long request; the outbox keeps email delivery out of it.
- A forwarded announcement email lets whoever holds it turn off that member's announcement emails, and nothing else. The member can turn them back on in Settings.
- Search permission tests exercise the real filters; only the text match differs between the test and production implementations.
