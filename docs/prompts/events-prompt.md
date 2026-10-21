# Feature: Implement the events subsystem

## Goal

Build, end to end, the events subsystem. Requirements, mocks and detailed designs already exist:

- `docs/detailed-designs/events/`: `create-and-edit-events` (L2-020), `event-list-and-filter` (L2-021),
  `rsvp` (L2-022), `public-events-and-guest-rsvp` (L2-023), `calendar-export` (L2-024), `cancel-events` (L2-025).
- Related: L2-003 and L2-002 (unverified accounts cannot RSVP), L2-028 (event emails), L2-042 (server-side
  authorization).

What users get:

- Event Lead, City Lead and System Admin create and edit events (title, description, type: Gathering, Builders
  night, Hackathon, Prayer & planning or Panel; start and end; city; in-person or online; venue or link; optional
  capacity; members-only or public visibility).
- Members list and filter events, RSVP and cancel an RSVP. Capacity is enforced. Leads and Staff see the full RSVP
  list; guest emails are shown to leads and System Admin only; leads and System Admin export it as CSV.
- Anonymous visitors see public events only: a shareable public event page, guest RSVP and an `.ics` download.
  Members-only events are never exposed anonymously.
- Calendar export produces `.ics` files.
- Event leads and System Admin cancel an event with a required reason after confirming. New RSVPs are refused and
  attendees are notified (in-app and email).
- Hackathon is an event type only. Hackathon teams, projects and judging are v2: do not build them.
- Staff is read-only.

Where it lives today (placeholders or partial):

- Backend: Domain `Events/` (Event, EventFormat, EventType, EventVisibility, Rsvp). Application, Infrastructure
  and Api have no event code yet. `.ics` generation belongs in Infrastructure.
- Frontend: `frontend/projects/events/` (with `SCAFFOLD.md`), plus `api` and `components`.
- Mocks: `docs/mocks/pages/{events,event,event-form,public-event}`, `docs/mocks/dialogs/{cancel-event,cancel-rsvp}`.
- Estimates: `docs/estimates/events.md` (six designs, all 0%).

Out of scope: global search indexing of events, announcements to an event's RSVP list, notification bell UI,
anything in v2.

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
  - Components library is mandatory. Cards, forms, date and time fields, badges, dialogs, filters and toasts come
    from `frontend/projects/components/`; add anything missing there first. `events` depends only on `components`
    and `api`. No inline forms; use CDK Dialog. No direct `HttpClient`; use contracts with tokens.
  - Anonymous access is opt-in per endpoint: only the public event page, public event data, guest RSVP and `.ics`
    for public events. Everything else requires authentication. Never leak members-only events or guest emails.
  - Business rules in Application handlers; migrations only in Infrastructure, applied by the Cli. Time, email and
    other externals sit behind abstractions. Seeds idempotent.
  - Backend tests: EF in-memory provider, unique database per fixture, fake time and email. No Docker or Postgres.
  - E2E: Playwright, Chromium only, page objects own selectors, axe check on every screen, including the public page.
  - Never write architecture tests. Tokens by role, WCAG 2.2 AA, Prettier and angular-eslint pass.
- Invoke and follow the `implementing-incrementally` skill before writing any code.
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Copy the house style of neighbouring code. Read the finished `profiles` feature (backend and frontend) and
  `identity` first and reuse its patterns.

## Phase 1: Check the documentation (no new mocks, specs or designs unless a gap is found)

- Read all six designs, the event mocks, ADRs and `docs/screen-composition.md`. Confirm every state has a mock
  (list empty and filtered, full, cancelled, RSVP going and waitlist or full, guest RSVP, invalid form; light, dark,
  phone, tablet, desktop).
- Fix any gap or contradiction first (skills `writing-html-mocks`, `extracting-design-systems`,
  `writing-requirements` with the next number after L2-054, `writing-design-documents`,
  `writing-screen-composition`). Record real decisions in ADRs.

## Phase 2: Incremental implementation (ATDD)

Plan thin vertical slices (each with backend and frontend acceptance tests). Suggested order:

1. Create and edit events: API, validation, role checks (403 others, Staff read-only), event form page.
2. Event list and filter: API and page, members-only vs public visibility, empty state.
3. RSVP and cancel RSVP: capacity, unverified email refused, RSVP list for leads and Staff, guest email
   visibility rules, CSV export.
4. Calendar export: `.ics` generation in Infrastructure and download from the event page.
5. Public events and guest RSVP: anonymous endpoints, shareable public page, guest RSVP confirmation email,
   `.ics`; prove members-only events return 404 to anonymous callers.
6. Cancel events: reason required, confirmation dialog, new RSVPs refused, attendee notification and email.
7. Playwright specs with page objects and axe checks for every screen; idempotent seed data in the Cli.

For each slice:
- Write the Given-When-Then criteria, then the acceptance test traced to its requirement.
- Run it and show it fails for the expected reason before writing production code.
- Implement the minimum to pass, refactor while green, run regression checks (backend tests, frontend unit
  tests, lint, Prettier, build), then commit.
- Do not start the next slice until the checks pass.

After all slices: update `docs/estimates/events.md` and the README roll-up to true percent complete (skill
`estimating-designs`); delete `frontend/projects/events/SCAFFOLD.md` once the project is real; keep mocks, design
system, screen composition and designs aligned with what was built.

## Done means

- L2-020 to L2-025 work end to end, enforced on the server, with anonymous access limited to public events.
- All new and existing backend, frontend unit and Playwright tests pass; lint, format and build are clean.
- The documentation agrees with the code; no `SCAFFOLD.md` remains in `events`.
- The work is on a branch with a pull request to `main`, and its checks are green. Fetch and rebase first.
- Only then end the run, with a short summary of what was built, decisions made (with ADR links) and anything
  deferred.
