# Feature: Implement the partners and contacts subsystems

## Goal

Build, end to end, two subsystems whose requirements, mocks and detailed designs already exist:

- `docs/detailed-designs/partners/`: `manage-partners`, `partner-kanban-board`. Requirements: L2-017, L2-018.
- `docs/detailed-designs/contacts/`: `manage-contacts`, `contact-notes`, `link-contact-on-sign-up`,
  `archive-restore-delete-contacts`. Requirements: L2-013, L2-014, L2-015, L2-016 (also L2-042 where it applies).

What users get:

- Contacts: a lead creates, edits and searches private contacts and adds private notes. Contacts and notes are
  visible only to the lead who created them and to System Admin (every System Admin read is audited). Others get
  404. Archive is a soft delete; contacts can be restored or deleted as designed. When the person signs up, the
  contact is linked to their profile; notes stay private.
- Partners: one shared pipeline. Leads, Staff and System Admin can view partners; leads and System Admin edit.
  Kanban stages Lead -> In Funnel -> Confirmed, moved with the keyboard and by drag, with stage changes recorded.
  Users without a lead role, Staff or System Admin get 403.
- Staff is read-only everywhere except private contacts (see `AGENTS.md` domain rules).

Where it lives today (placeholders or partial):

- Backend: Domain `Contacts/` (Contact, ContactNote), `Partners/` (Partner, PartnerStage, PartnerStageChange);
  Application, Infrastructure and Api have no feature code for these yet.
- Frontend: `frontend/projects/contacts/`, `frontend/projects/partners/` (each has a `SCAFFOLD.md`), plus `api`,
  `components`.
- Mocks: `docs/mocks/pages/{contacts,archived-contacts,contact,contact-form,partners,partner}`,
  `docs/mocks/dialogs/{add-partner,archive-contact,delete-contact,link-contact,move-partner}`.
- Estimates: `docs/estimates/contacts.md`, `docs/estimates/partners.md`.

Out of scope: events, search indexing of contacts and partners beyond what these designs state, notifications UI.

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
  - Components library is mandatory. Build every UI piece (Kanban board and columns, cards, dialogs, form fields,
    badges, tables) in `frontend/projects/components/` first; features only compose. Features depend only on
    `components` and `api`. No inline forms; use CDK Dialog. No direct `HttpClient`; use contracts with tokens.
  - Private contacts and notes: visible only to the creating lead and System Admin, enforced in every query
    and endpoint. Write authorization tests for this first. See ADR 0003 (private contacts are not profiles).
  - Business rules in Application handlers; migrations only in Infrastructure, applied by the Cli. Endpoints
    authenticated by default. Seeds idempotent.
  - Backend tests: EF in-memory provider, unique database per fixture, fakes for externals. No Docker or Postgres.
  - E2E: Playwright, Chromium only, page objects own selectors, axe check on every screen.
  - Never write architecture tests. Tokens by role, WCAG 2.2 AA, Prettier and angular-eslint pass.
- Invoke and follow the `implementing-incrementally` skill before writing any code.
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Copy the house style of neighbouring code. Read the finished `profiles` feature (backend and frontend) and
  `identity` first and reuse its patterns.

## Phase 1: Check the documentation (no new mocks, specs or designs unless a gap is found)

- Read all four contacts designs, both partners designs, the mocks, ADRs and `docs/screen-composition.md`.
  Confirm every state has a mock (light, dark, phone, tablet, desktop).
- Resolve the open question in `frontend/projects/partners/SCAFFOLD.md`: Edit navigates to an edit screen, but no
  mock or page exists. Add the partner form mock (reuse the contact-form pattern), design-system and
  screen-composition entries, and update `manage-partners` before building it. Check `contacts/SCAFFOLD.md` for
  further open questions and resolve them the same way, recording an ADR where a real decision is made.
- Fix any other gap or contradiction first (skills `writing-html-mocks`, `extracting-design-systems`,
  `writing-requirements` with the next number after L2-054, `writing-design-documents`,
  `writing-screen-composition`).

## Phase 2: Incremental implementation (ATDD)

Plan thin vertical slices (each with backend and frontend acceptance tests). Suggested order:

1. Contacts API: create, edit, get, list with owner-only visibility, 404 for others, System Admin read audited.
2. Contacts search and list page, contact form dialog or page as designed.
3. Contact notes: add, list, edit as designed, same privacy rules, notes visible on linked contacts.
4. Archive, restore and delete contacts: API, archived contacts page, dialogs.
5. Link contact on sign-up: match on email at registration, link, keep notes private, notify the lead as designed.
6. Partners API: create, edit, list, view; role checks (403 for non-leads, Staff read-only).
7. Partner Kanban: stage move API with stage-change history, Kanban page, move dialog, keyboard-accessible move.
8. Playwright specs with page objects and axe checks for every new screen; idempotent seed data in the Cli.

For each slice:
- Write the Given-When-Then criteria, then the acceptance test traced to its requirement.
- Run it and show it fails for the expected reason before writing production code.
- Implement the minimum to pass, refactor while green, run regression checks (backend tests, frontend unit
  tests, lint, Prettier, build), then commit.
- Do not start the next slice until the checks pass.

After all slices: update `docs/estimates/contacts.md`, `docs/estimates/partners.md` and the README roll-up to true
percent complete (skill `estimating-designs`); delete the two `SCAFFOLD.md` files once their projects are real;
keep mocks, design system, screen composition and designs aligned with what was built.

## Done means

- L2-013 to L2-018 work end to end, enforced on the server, with private-contact visibility proven by tests.
- All new and existing backend, frontend unit and Playwright tests pass; lint, format and build are clean.
- The documentation agrees with the code; no `SCAFFOLD.md` remains in `contacts` or `partners`.
- The work is on a branch with a pull request to `main`, and its checks are green. Fetch and rebase first.
- Only then end the run, with a short summary of what was built, decisions made (with ADR links) and anything
  deferred.
