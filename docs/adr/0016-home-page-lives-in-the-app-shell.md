# 0016. Home page lives in the app shell

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-049
- Designs: `docs/detailed-designs/platform/home`

## Context

Every signed-in member lands on home at `/`. Home shows upcoming events, the partner pipeline and the member's recent activity. That data belongs to three features: events, partners and notifications. AGENTS.md says the app holds the shell, top-level routes and guards but no feature pages, and that feature libraries depend only on `components` and `api`, never on each other. The repository layout lists no home library, and the layout changes only with the user's approval. The route already pointed at a scaffold `HomePage` in `frontend/projects/faithtech-community/src/app/pages/home`.

Home also needs a recent-activity feed. Draft PR #335 is building the notifications read API and announcements, and the database records no publish time for events and no sign-up time for profiles.

## Decision

- `HomePage` stays where the route already points: `frontend/projects/faithtech-community/src/app/pages/home`. It is the shell's landing route, not a feature page. It owns no data and composes only `components` and `api` services (`EVENTS_SERVICE`, `PARTNERS_SERVICE`, `ACTIVITY_SERVICE`). Putting it in a feature library would make that library read the other features, or would need a new library, which is a layout change.
- Recent activity is served by `GET /api/activity` from `ListActivityHandler` in Application `Notifications/`. It returns the ten newest notifications addressed to the caller. Each one already goes to one member, so the feed cannot leak private contacts or other members' data, and Staff see only what was sent to them.
- Each card loads on its own. A failure in the pipeline or the feed leaves the rest of home in place, and only a failure to load events replaces the page with the error state.

## Consequences

- No new folder or project. The home route keeps one component in the app.
- Logic that more than one screen needs, such as the feed's time format, goes into `components`, not the page.
- Community-wide activity (events published, announcements sent, sign-ups) waits for PR #335 and for publish times on events. When it lands, `ListActivityHandler` can merge those items, filtered by the same permissions as their own lists, without changing the endpoint's contract.
