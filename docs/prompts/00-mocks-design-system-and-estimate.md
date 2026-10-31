# Feature: Organisations: mocks, design system, screen composition and estimate

Slice 00 of the organisations plan (`docs/prompts/README.md`).

## Goal

The organisations subsystem has its proposal (`docs/proposals/organisations.md`), its requirements (`L1-025` to
`L1-029`, `L2-130` to `L2-152`), nine detailed designs in `docs/detailed-designs/organisations/` and ADRs 0032 to
0035, but no mocks, no design-system pages for its new components and no estimate. `AGENTS.md` requires a mock before
any production behaviour is implemented, so this change produces the remaining design artefacts. It writes no
production code and no tests (ATDD does not apply to mocks or the design system).

## Before you start

- Depends on: Nothing; this is the first prompt.
- `git fetch origin && git switch main && git pull`, then `git switch -c feature/organisations-00-mocks-design-system-and-estimate`.
- Read `AGENTS.md`, `docs/proposals/organisations.md`, `docs/prompts/README.md` (the slice plan and what each earlier
  slice left in place) and the documents listed under "Read first".
- Run the suites once before you change anything, so you know the starting state:
  `dotnet test backend/FaithTech.Community.sln`, `cd frontend && npm run lint && npx prettier --check .` and the
  Angular unit tests, and `cd e2e && npx playwright test`. Fix nothing that is unrelated; note any failure that was
  already there.

## Read first

- `docs/detailed-designs/organisations/` (all nine READMEs)
- `docs/specs/L2.md` `L2-130` to `L2-152`, and the rewritten `L2-009`, `L2-010`, `L2-019`, `L2-020`, `L2-021`, `L2-039`, `L2-041`, `L2-045`, `L2-048`, `L2-053`
- `docs/mocks/README.md`, `docs/mocks/manifest.json`, `docs/mocks/index.html` and neighbours such as `docs/mocks/pages/settings`, `docs/mocks/pages/audit-log`, `docs/mocks/pages/forbidden`, `docs/mocks/pages/private-preview`, `docs/mocks/dialogs/add-role`, `docs/mocks/dialogs/remove-role`
- `docs/design-system/README.md` and its `components/` pages (menu, tabs, list, switch, checkbox, select, dialog, badge)
- `docs/screen-composition.md`, `docs/estimates/README.md` and one subsystem table such as `docs/estimates/reports.md`

## Finish the whole change in one run. Do not stop. (CRITICAL)

- You are authorised to take this change all the way: mocks, design system, screen composition and the estimate, green tests and a pull request.
  Go through every phase and every step in one continuous run. Do not pause between phases to report, ask
  for approval, or wait for "continue".
- Do not end your turn until the "Done means" list at the bottom is fully true. A partial result, a plan, or
  "the next steps would be..." is not done.
- Where `AGENTS.md` says "stop and ask", treat this prompt as the confirmation in advance for everything in
  scope here. Choose the simplest option that fits the existing architecture, record it (an architecture
  decision record or the detailed design's open-questions section), and keep going.
- If the `components` library lacks something, that is not a reason to stop. Update the design system and the
  library first, as the project rules require, then go on.
- When a test, build or command fails, find the root cause and fix it, then go on. Never weaken a test to make
  it pass, and never skip a step quietly.
- Only stop for a real blocker you cannot resolve yourself, such as missing credentials, or an action outside
  this repository that can't be undone, such as production deploys or data changes. If that happens, finish
  everything else first, then report the blocker clearly.
- Keep track of progress (a todo list), so that nothing gets left out after context is summarised.

## Rules (read first, binding)

- Follow `AGENTS.md` exactly, especially:
  - **Repository layout is a mandate.** Every file goes in the folder the tree assigns it. Organisations code goes in
    `Domain/Organisations/`, `Application/Organisations/` (operator code in its `Platform/` sub-folder),
    `frontend/projects/organisations/`, `e2e/tests/organisations/`. Do not add top-level folders or projects.
  - **The `components` library is mandatory.** Every design-system component is built once in
    `frontend/projects/components/` and reused. A missing component or variant is added there first, matching
    `docs/design-system/`. Feature libraries depend only on `components` and `api`, never on each other, and never call
    `HttpClient`.
  - **Permissions are capabilities, never role names** (ADR 0033). Handlers check `ICurrentUser.Has(capability)`
    once slice 10 has added it; before then, add no new role-name check. FaithTech's role names, its "City" label, its
    stages and its types end up only in the seed (`L2-151`); never add a new use of them elsewhere.
  - **The host decides the organisation** (ADR 0032). Never resolve it from a token, header, cookie, query or body.
    Every scoped query filters through the DbContext's global query filter. An id from another organisation is 404.
  - Business rules live in Application handlers and Domain, never in endpoints. Endpoints require authentication by
    default; anonymous access is opted into per endpoint.
  - EF Core migrations live only in `backend/src/FaithTech.Community.Infrastructure/Persistence/Migrations/` and are
    applied by the Cli, never by the API. Seed data is idempotent.
  - Backend tests live under `backend/tests/`, use the EF Core in-memory provider with a uniquely named database per
    fixture, and never need Docker, PostgreSQL or any external service. Arrange callers by capability set once
    capabilities exist (slice 10 on), and use the FaithTech seed as the regression case. Test organisation isolation for
    every new query.
  - Playwright: Chromium only, Page Object Model (selectors only in `e2e/pages/`), fake backend only (fake behaviour in
    `e2e/fixtures/`, an unrouted request fails the test), axe checks on every screen. Keep the fake in step with every
    endpoint, DTO and permission rule you change, in the same change.
  - Frontend: Prettier and angular-eslint must pass; WCAG 2.2 AA; tokens by role, never hex; CDK Dialog for modals;
    no inline forms in pages; API services have a contract and an injection token.
  - Never write architecture tests (structure, naming, banned-API or traceability tests).
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Work through the phases below **in order**, using the skill each phase names.
- Copy the house style of each folder. Read the existing neighbours before you write anything new.

## Phase 1: Mocks (`writing-html-mocks`)

Add mocks in `docs/mocks/` in every state, light and dark, at phone, tablet and desktop widths, with real copy taken
from the acceptance criteria. Name them as `L2-147` AC4 does:

- Pages: `pages/organisation-general` (`organisation/general`: description list, Edit, chapters on and off,
  read-only for a holder of only `ManageRoles`), `pages/organisation-roles` (list with holder count, capability
  summary and flag badges, Archived filter, empty, read-only), `pages/organisation-chapters` (ordered list with member
  counts, keyboard reorder with live-region text, Archived filter, chapters-off empty state linking to General,
  read-only), `pages/organisation-taxonomies` (three sections Partner stages, Event types, Resource types; Initial and
  kind badges on stages; Archived filter; read-only).
- Dialogs: `edit-general-settings`, `turn-chapters-off`, `define-role` (define and edit modes, chapter switch only
  when chapters are on, 403 "Only an administrator can grant administration."), `edit-grants` (disabled
  administration entries, the "can't assign roles until it has the Assign roles capability" caption),
  `archive-role` (409 reasons), `add-chapter`, `rename-chapter`, `archive-chapter`, `add-list-entry`,
  `rename-list-entry`, `archive-list-entry` (409 "{n} partners are on this stage. Move them first."). Every dialog:
  default, invalid, busy ("Saving…"), failed with "Try again", and success toast.
- Changed screens: `dialogs/add-role` and `dialogs/remove-role` (organisation's roles, chapter picker for a
  chapter-scopable role, "{role} · {chapter}" entries), the account menu with "Switch organisation" (shell part),
  `pages/edit-profile` (Home {chapter} picker), `pages/event-form` ({Chapter} picker with "{Organisation}-wide", type
  from the organisation's list), `pages/team`, `pages/events`, `pages/people`, `pages/reports` (chapter filter
  "All {Chapters}", empty state naming the chapter), `pages/partners` (columns from stages, "Archived stage: {name}"
  column), `pages/audit-log` (the four new categories).
- System pages: `pages/unknown-host` ("There's nothing here", neutral, no product name, in the manner of
  `pages/private-preview`), `pages/organisation-suspended` (neutral 503), `pages/not-a-member` ("You're not a member
  of {organisation}", sign-out, links to other memberships, and the no-other-membership variant).
- Show a second organisation (for example "Northside Church" with chapter label Campus/Campuses) beside FaithTech in
  at least the general, chapters, team-filter and switcher mocks, so the copy is visibly organisation-agnostic.
- Update `docs/mocks/manifest.json`, `docs/mocks/index.html` (gallery) and the coverage matrix in
  `docs/mocks/README.md`.

## Phase 2: Design system (`extracting-design-systems`)

- Add component pages to `docs/design-system/components/` for the new components the designs name:
  `capability-checklist` (checkbox per catalogue entry with description, disabled entry with caption),
  `define-role-dialog`, `edit-grants-dialog`, `archive-role-dialog`, and the reorderable list pattern with move up
  and move down buttons if `list.html` does not already document it. Extend `role-dialog` (or the page that documents
  it) with the chapter select, and `menu` with a header-plus-links group for "Switch organisation".
- Document every variant, size and state, WCAG 2.2 AA notes, tokens and code. Change tokens only if a new value is
  needed (none is expected). Update `docs/design-system/README.md`.

## Phase 3: Screen composition (`writing-screen-composition`)

- Update `docs/screen-composition.md` for every new and changed screen above: the `components` components each is
  composed of, and the feature-local glue (the `organisations` library's pages and dialogs).

## Phase 4: Estimate (`estimating-designs`)

- Add `docs/estimates/organisations.md`: one row per design in `docs/detailed-designs/organisations/` with a
  developer-day estimate and 0% complete. Add the subsystem to `docs/estimates/README.md` with its effort and
  percent, recompute the overall effort and effort-weighted percent, and put organisations on the roadmap. Note in
  the subsystem tables of the features the organisation slices will change (team, events, partners, resources,
  profiles, admin, reports, identity, invites, platform) that their percent drops while those slices are open, if the
  estimating skill's rules say so.
- Update `docs/proposals/organisations.md` "Status" and "Next step" to say mocks, design system and estimate are
  done and the slices in `docs/prompts/` follow. Change row `00` in `docs/prompts/README.md` to "Done".

## Done means

- Every screen, dialog and system page named in `L2-131`, `L2-132`, `L2-133`, `L2-136`, `L2-137`, `L2-140`,
  `L2-147` and the changed screens above has a mock in every state, light and dark, at three widths, listed in the
  manifest, gallery and coverage matrix.
- The design system documents every new component and variant; `docs/screen-composition.md` covers every new and
  changed screen; `docs/estimates/organisations.md` exists and the root estimate includes it.
- No production code or test changed.
- The work is on the branch above with a pull request to `main`, and its checks are green. Fetch and rebase first.
- Only then end the run, with a short summary of what was added and any decision recorded.
