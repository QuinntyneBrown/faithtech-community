# Feature: Implement the team list

## Goal

Build, end to end, the team subsystem. Its requirement, mocks and detailed design already exist:

- Design: `docs/detailed-designs/team/team-list/`.
- Requirement: L2-019 (traces to L1-007).

What users get:

- Any signed-in member opens the team page and sees every profile holding a lead or volunteer role, with name,
  photo and roles.
- A role filter (Leads or Volunteers) and a city filter narrow the list.
- A profile that loses its last lead or volunteer role no longer appears.
- Anonymous visitors see nothing (profiles are for signed-in members only).

Where it lives today:

- Backend: `backend/src/FaithTech.Community.Domain/Team/TeamRoles.cs` only. Application, Infrastructure and Api
  have no team code. Reuse the finished `Profiles` feature for profile and photo data.
- Frontend: `frontend/projects/team/` (placeholder with `SCAFFOLD.md`), plus `api` and `components`.
- Mocks: `docs/mocks/pages/team/` and `docs/mocks/pages/team-board/`.
- Estimate: `docs/estimates/team.md` (team-list, 2 days, 0%).

Out of scope: editing team membership (done through role assignment in the admin subsystem), the Agile
team-board workspace unless `team-list` explicitly depends on it, search indexing.

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
  - Components library is mandatory. Cards, avatars, badges, filters and empty states come from
    `frontend/projects/components/`; add anything missing there first. The `team` library depends only on
    `components` and `api`. No direct `HttpClient`; use a contract and injection token in `api`.
  - Data is global (no city boundary). The city filter is a filter, not a permission boundary.
  - Profiles are visible to signed-in members only. Enforce this on the server.
  - Business rules in Application handlers; endpoints authenticated by default. Seeds idempotent.
  - Backend tests: EF in-memory provider, unique database per fixture, fakes for externals. No Docker or Postgres.
  - E2E: Playwright, Chromium only, page objects own selectors, axe check on every screen.
  - Never write architecture tests. Tokens by role, WCAG 2.2 AA, Prettier and angular-eslint pass.
- Invoke and follow the `implementing-incrementally` skill before writing any code.
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Copy the house style of neighbouring code. Read the finished `profiles` feature (backend and frontend) first
  and reuse its patterns.

## Phase 1: Check the documentation (no new mocks, specs or designs unless a gap is found)

- Read `team-list`, the team mocks, relevant ADRs and `docs/screen-composition.md`. Confirm every state has a
  mock (default, filtered, empty, loading, error; light, dark, phone, tablet, desktop).
- Check whether `docs/mocks/pages/team-board/` belongs to this feature or to Agile, and treat it accordingly.
- Fix any gap or contradiction first (skills `writing-html-mocks`, `extracting-design-systems`,
  `writing-requirements` with the next number after L2-054, `writing-design-documents`,
  `writing-screen-composition`).

## Phase 2: Incremental implementation (ATDD)

Plan thin vertical slices (each with backend and frontend acceptance tests). Suggested order:

1. Team list API: signed-in members only (401 anonymous), returns profiles with a lead or volunteer role, with
   name, photo and roles (L2-019 criterion 1).
2. Filters: role (Leads or Volunteers) and city (criterion 2).
3. Role loss: a profile that loses its last lead or volunteer role drops off (criterion 3).
4. Team page: routes, lazy-load from the app shell, list, filters, empty and error states, keyboard and
   screen-reader checks.
5. Playwright spec with a page object and axe check; idempotent seed data in the Cli if needed.

For each slice:
- Write the Given-When-Then criteria, then the acceptance test traced to its requirement.
- Run it and show it fails for the expected reason before writing production code.
- Implement the minimum to pass, refactor while green, run regression checks (backend tests, frontend unit
  tests, lint, Prettier, build), then commit.
- Do not start the next slice until the checks pass.

After all slices: update `docs/estimates/team.md` and the README roll-up to true percent complete (skill
`estimating-designs`); delete `frontend/projects/team/SCAFFOLD.md` once the project is real; keep mocks, design
system, screen composition and the design aligned with what was built.

## Done means

- L2-019 works end to end, enforced on the server.
- All new and existing backend, frontend unit and Playwright tests pass; lint, format and build are clean.
- The documentation agrees with the code; no `SCAFFOLD.md` remains in `team`.
- The work is on a branch with a pull request to `main`, and its checks are green. Fetch and rebase first.
- Only then end the run, with a short summary of what was built, decisions made (with ADR links) and anything
  deferred.
