# Feature: Implement notifications, announcements and global search

## Goal

Build, end to end, three subsystems whose requirements, mocks and detailed designs already exist:

- `docs/detailed-designs/notifications/`: `in-app-notifications` (L2-027), `email-notifications` (L2-028).
- `docs/detailed-designs/announcements/`: `send-announcement` (L2-029), `read-announcements-and-opt-out` (L2-030).
- `docs/detailed-designs/search/`: `global-search` (L2-026).

What users get:

- Notifications: a bell with an unread count and a newest-first panel; opening an item marks it read and goes to
  the related item; "Mark all as read"; a notifications page with an empty state. Notification emails are queued
  and sent within 2 minutes, retried up to 5 times, with a plain-text part and HTTPS links. Only announcement
  emails can be turned off.
- Announcements: Communications Lead and System Admin compose and send to everyone, chosen roles or one event's
  RSVP list, see the recipient count before sending, and get inline errors for an empty subject or body. Each
  recipient gets an in-app notification, plus an email by default ("Also send by email") unless they opted out.
  Everyone else gets 403 on send. Members read the announcements sent to them, newest first, turn announcement
  emails off in settings, and can unsubscribe from an email link without signing in.
- Search: a signed-in member searches and gets results grouped into people, events, partners, contacts and work
  items using Postgres full-text search, showing only what that user may open (own contacts only; partners only
  for leads, Staff and System Admin; work items only for workspace members, Staff and System Admin). Empty state
  on no match; under 2 characters no search runs and a hint shows; p95 under 500 ms at 100,000 records.

Where it lives today (placeholders or partial):

- Backend: Domain `Notifications/` (Notification, NotificationKind), `Announcements/` (Announcement,
  AnnouncementAudience, AnnouncementRecipient, AudienceKind). Application, Infrastructure and Api have no code
  for these yet. Email, search and queue pieces belong in Infrastructure.
- Frontend: `frontend/projects/{notifications,announcements,search}/` (each has a `SCAFFOLD.md`), plus `api`
  and `components`. The announcements library also covers the read page and opt-out settings.
- Mocks: `docs/mocks/pages/{notifications,announcements,search,compose-announcement}`, `docs/mocks/notifications/{bell,toast}`.
- Estimates: `docs/estimates/{notifications,announcements,search}.md`, all 0%.

Dependency note: other subsystems (invites, events, admin, contacts, agile) will raise notifications and emails.
Build the notification and email services behind clear Application abstractions so they can call them, and wire
only the triggers that exist in the code today. Search must cover only the subsystems that exist; add each
searchable type behind an interface so later features plug in. List anything unwired under deferred.

Out of scope: building the features that trigger notifications (invites, events, Agile), push notifications,
notification preferences beyond the announcement opt-out.

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: doc verification, incremental ATDD implementation of every
  slice, green tests and a pull request. Go through every phase and slice in one continuous run. Do not pause to
  report, ask for approval, or wait for "continue".
- Do not end your turn until the "Done means" list is fully true. A partial result, a plan, or "the next steps
  would be..." is not done.
- Where `AGENTS.md` says "stop and ask", treat this prompt as the confirmation in advance for everything in scope.
  Choose the simplest option that fits the existing architecture, record it (an ADR in `docs/adr/`, next number
  after the latest, or the design's open-questions section), and keep going.
- If `components` lacks something, update the design system and the library first, as the rules require, then go on.
- When a test, build or command fails, find the root cause and fix it. Never weaken a test, never skip a step.
- Only stop for a real blocker you cannot resolve yourself. Finish everything else first, then report it.
- Keep a todo list so nothing is lost after context is summarised.

## Rules (read first, binding)

- Follow `AGENTS.md` exactly, especially:
  - Repository layout is mandatory. No new top-level folders or projects.
  - Components library is mandatory. Bell, notification list, toasts, search field, result groups, forms, badges and
    empty states come from `frontend/projects/components/`; add anything missing there first. Feature libraries
    depend only on `components` and `api`, never on each other. The bell lives in the app shell and uses the
    `api` notification contract, not the `notifications` pages. No inline forms; use CDK Dialog. No direct
    `HttpClient`; use contracts with tokens.
  - Permissions are enforced on the server in every query, including search. Test the permission rules in L2-026
    criterion 2 first. Never rely on the UI to hide data.
  - Business rules in Application handlers; endpoints authenticated by default. The unsubscribe link is the only
    anonymous endpoint here: make it opt-in, signed and single-purpose. Migrations only in Infrastructure, applied
    by the Cli. Seeds idempotent. Secrets stay out of the repo.
  - Backend tests: EF in-memory provider, unique database per fixture, fakes for email, time and queue. No Docker
    or Postgres. Test the full-text search through an abstraction with an in-memory implementation for tests, and
    keep the Postgres implementation in Infrastructure.
  - E2E: Playwright, Chromium only, page objects own selectors, axe check on every screen.
  - Never write architecture tests. Tokens by role, WCAG 2.2 AA, Prettier and angular-eslint pass.
- Invoke and follow the `implementing-incrementally` skill before writing any code.
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Copy the house style of neighbouring code. Read the finished `profiles` feature (backend and frontend) and
  `identity` first and reuse its patterns.

## Phase 1: Check the documentation (no new mocks, specs or designs unless a gap is found)

- Read all five designs, the mocks, ADRs and `docs/screen-composition.md`. Confirm every state has a mock (bell,
  panel, toast, notifications page, announcements page, compose page, search default, empty, no-results, short term,
  loading, error; light, dark, phone, tablet, desktop).
- Check for missing mocks: the settings screen with the announcement email opt-out, and the unsubscribe landing
  page. Add them if absent.
- Fix any gap or contradiction first (skills `writing-html-mocks`, `extracting-design-systems`,
  `writing-requirements` with the next number after L2-054, `writing-design-documents`,
  `writing-screen-composition`). Record real decisions in ADRs.

## Phase 2: Incremental implementation (ATDD)

Plan thin vertical slices (each with backend and frontend acceptance tests). Suggested order:

1. In-app notifications API: create, list newest first, unread count, mark read, mark all read.
2. Bell, panel and notifications page in the shell and `notifications` library, with empty state.
3. Email notifications: queue, sender abstraction, retry up to 5 times, plain-text part, HTTPS links, delivery
   within 2 minutes (fake time), opt-out honoured for announcement emails only.
4. Send announcement: audiences (everyone, roles, event RSVP list), recipient count preview, validation, 403 for
   others, per-recipient notification, optional email. Compose page.
5. Read announcements and opt-out: list newest first, settings toggle, signed unsubscribe link that works without
   sign-in.
6. Search API: grouped results, permission filtering (own contacts, partners for leads, Staff and System Admin,
   work items for members, Staff and System Admin), minimum 2 characters, abstraction with Postgres full-text
   implementation and an in-memory test implementation.
7. Search page and header search: results, empty state, short-term hint. Add a performance check for the 500 ms p95
   target where it can run without external services, or record how it is verified in the design.
8. Playwright specs with page objects and axe checks for every screen; idempotent seed data in the Cli.

For each slice:
- Write the Given-When-Then criteria, then the acceptance test traced to its requirement.
- Run it and show it fails for the expected reason before writing production code.
- Implement the minimum to pass, refactor while green, run regression checks (backend tests, frontend unit
  tests, lint, Prettier, build), then commit.
- Do not start the next slice until the checks pass.

After all slices: update the three estimate files and the README roll-up to true percent complete (skill
`estimating-designs`); delete the three `SCAFFOLD.md` files once their projects are real; keep mocks, design
system, screen composition and designs aligned with what was built.

## Done means

- L2-026, L2-027, L2-028, L2-029 and L2-030 work end to end, enforced on the server, with search results filtered
  by permission and proven by tests.
- All new and existing backend, frontend unit and Playwright tests pass; lint, format and build are clean.
- The documentation agrees with the code; no `SCAFFOLD.md` remains in `notifications`, `announcements` or `search`.
- The work is on a branch with a pull request to `main`, and its checks are green. Fetch and rebase first.
- Only then end the run, with a short summary of what was built, decisions made (with ADR links), triggers and
  searchable types left unwired, and anything else deferred.
