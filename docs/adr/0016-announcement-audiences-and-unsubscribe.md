# 0016. Announcement audiences, reading and unsubscribe

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-029, L2-030, L2-052 AC4
- Designs: `docs/detailed-designs/announcements/send-announcement`, `docs/detailed-designs/announcements/read-announcements-and-opt-out`

## Context

The announcement designs left the unsubscribe token's lifetime, the unsubscribe landing page, the background fan-out and the home of the settings screen open. The event RSVP audience needs events and RSVPs in the database, which the events feature has not built. The compose mock offered a single role while L2-029 allows several.

## Decision

- **Who sends.** Only callers whose token holds Communications Lead or System Admin may preview a count or send; everyone else gets `403` (L2-029 AC3). Any signed-in member reads announcements.
- **Audiences.** `Everyone` resolves to every profile that is not suspended. `Roles` resolves to every non-suspended profile holding at least one chosen role; the compose page picks roles with a checkbox group. `EventRsvps` answers `400` ("Event audiences arrive with events") until the events feature stores RSVPs; the compose page does not offer it yet.
- **API.** `POST /api/announcements/recipient-count` takes `{ kind, roles }` and returns `{ count }`. `POST /api/announcements` takes `{ subject, body, audience: { kind, roles }, alsoEmail }` (subject up to 150 characters, body up to 5,000) and returns `201` with `{ id, recipientCount }`. Sending stores the `Announcement` with its recipients and publishes one `Announcement` notification per recipient through `INotificationPublisher`, with the email when `alsoEmail` is on (the default). The fan-out runs in the request.
- **Reading.** `GET /api/announcements?page=` lists, newest first, the announcements the caller received or sent, with sender name, audience and recipient count, 20 per page.
- **Opt-out.** `GET` and `PUT /api/me/announcement-email-opt-out` read and set `{ optedOut }`. The settings screen at `/settings` lives in the `announcements` library and shows the "Email me when" section: one switch, "Email me announcements", saved as soon as it changes with a toast. The mock's Account section and "Sign out everywhere" belong to account settings (L2-052) and are not built yet.
- **Unsubscribe.** Each announcement email ends with `{WebApp:Origin}/unsubscribe?token=…`. The token is the recipient's profile id protected by ASP.NET Data Protection with the purpose `Announcements.Unsubscribe` and a 365-day lifetime, so it does nothing else and cannot be forged. The landing page (`docs/mocks/pages/unsubscribe`) posts it to `POST /api/announcements/unsubscribe`, the only anonymous endpoint here, which is rate-limited like the other anonymous account endpoints. A bad or expired token answers `400` and the page offers settings instead.

## Consequences

- When events store RSVPs, the event audience needs a resolver and a picker on the compose page; nothing else changes.
- Rotating the Data Protection keys invalidates outstanding unsubscribe links; members can still opt out in settings.
- Account settings (L2-052) will add their section to the same settings page.
