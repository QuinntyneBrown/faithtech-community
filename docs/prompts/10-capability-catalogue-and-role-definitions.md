# Feature: Capability catalogue and FaithTech role definitions

Slice 10 of the organisations plan (`docs/prompts/README.md`).

## Goal

Turn FaithTech's nine roles into data without changing a single permission yet. Add the 19-entry capability catalogue,
the `RoleDefinition` and `RoleGrantRule` entities, the FaithTech seed of nine definitions and the City Lead grant
rules, and move `ProfileRole` from the `Role` enumeration to `RoleDefinitionId`. The server computes the caller's
capability set on every request and `/api/me` adds `capabilities`; access classes still decide as before through a
temporary adapter, which slice 11 removes.

## Before you start

- Depends on: Prompts `00` to `09` in `docs/prompts/` are merged to `main`. If one is not, stop and say which.
- `git fetch origin && git switch main && git pull`, then `git switch -c feature/organisations-10-capability-catalogue-and-role-definitions`.
- Read `AGENTS.md`, `docs/proposals/organisations.md`, `docs/prompts/README.md` (the slice plan and what each earlier
  slice left in place) and the documents listed under "Read first".
- Run the suites once before you change anything, so you know the starting state:
  `dotnet test backend/FaithTech.Community.sln`, `cd frontend && npm run lint && npx prettier --check .` and the
  Angular unit tests, and `cd e2e && npx playwright test`. Fix nothing that is unrelated; note any failure that was
  already there.

## Read first

- `docs/detailed-designs/organisations/capabilities-and-authorization/README.md` (Domain `Capability`, `ProfileCapabilities`, `CurrentRolesMiddleware`, `ICurrentUser`, `CapabilitiesEndpoints`)
- `docs/detailed-designs/organisations/role-definitions-and-grant-rules/README.md` (Domain `RoleDefinition`, `RoleGrantRule`, `ProfileRole`)
- `docs/detailed-designs/organisations/seed-faithtech/README.md` (the definitions table, grant rules, migration step 4)
- ADR 0033
- `Domain/Profiles/Role.cs`, `ProfileRole`, `HttpCurrentUser`, `RoleAssignmentPolicy`, `ResourceShareRoles`, `NoteShareRoles`, announcement role audiences

## Finish the whole slice in one run. Do not stop. (CRITICAL)

- You are authorised to take this slice all the way: checking the design artefacts, incremental ATDD implementation, the estimate update, green tests and a pull request.
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

## Scope

In scope, by acceptance criterion:

- `L2-135` AC1 (`GET /api/organisation/capabilities`)
- `L2-135` AC2 (capabilities computed per request from non-archived held definitions)
- `L2-151` AC2 (the nine definitions, flags and grant rules)
- `L2-151` AC4, the role part (every `ProfileRole`, share role and announcement role audience maps to the definition of the same name)
- `L2-133` AC1, the `capabilities` field (additive; `roles` keeps its current shape until slice 12)

Deferred (do not build here; a later slice owns it):

- Switching access classes to `Has(capability)` and removing `Role` (slice 11)
- Frontend and fake reading capabilities (slice 12)
- Role-definition management endpoints (slices 16, 17)
- Grant-rule-based assignment (slice 14)

## Phase 1: Check the design artefacts

The requirements, designs and ADRs already exist, and prompt `00` added the mocks, the design-system changes and
`docs/estimates/organisations.md`. Do not rewrite them. Check that they cover this slice:

- The design has a `<TO SUPPLY>` for fixed ids in `FaithTechSeed`: choose them now (constant GUIDs), never change them, and record that in the design.
- `RoleDefinition.Key` for definitions created later on the Roles page is `<TO SUPPLY>`: adopt the design's proposal (slug from the name at creation, unique per organisation) and record it.
- Where something this slice needs is missing or contradicts the code, fix the artefact first with its skill
  (`writing-html-mocks`, `extracting-design-systems`, `writing-screen-composition`, `writing-requirements`,
  `writing-design-documents`), and record any decision in the design's open questions or a new ADR.

## Phase 2: Incremental implementation (ATDD)

- Invoke the `implementing-incrementally` skill before writing any code, and follow it with ATDD.
- Plan the thin steps below (adjust them if the code says otherwise). For each step:
  - Write the Given-When-Then criteria, taken from the cited acceptance criteria.
  - Write the acceptance test first: an Api integration test in `backend/tests/FaithTech.Community.Api.Tests/` (or an
    Application or Infrastructure test where the behaviour lives there), and a Playwright spec through page objects
    when the step changes what a member sees. Name the requirement and criterion in the test name or a comment.
  - Run it and show that it fails for the expected reason.
  - Implement the minimum that makes it pass, and refactor while the tests are green.
  - Run the regression checks (the whole backend suite, lint and format, the Angular unit tests, and the Playwright
    specs for every feature the step touched), then commit with a message that says what changed and why.

  1. `Capability` catalogue in `Domain/Organisations/` with descriptions and `IsKnown`; `GET /api/organisation/capabilities` for any member; Api test of the exact list.
  2. `RoleDefinition` (key, name, description, capabilities, `ShowOnTeam`, `ChapterScopable`, `IsOversight`, sort order, archived) and `RoleGrantRule`, scoped; mapping and migration; `FaithTechSeed` holds the nine definitions and the City Lead rules; seeder inserts them by key idempotently; Infrastructure test of the seed and its re-run.
  3. `ProfileRole.RoleDefinitionId` replaces `Role`; migration maps each enumeration value to the definition of the same name, and does the same for resource and note share roles and announcement role audiences; then drops the columns.
  4. `ProfileCapabilities.OfAsync`; `CurrentRolesMiddleware` stores held definitions and the capability union; `ICurrentUser.Capabilities` and `Has` (true for `AdministerOrganisation`).
  5. Temporary adapter: `HttpCurrentUser.HasRole(Role)` answers from the held definitions' keys so every access class keeps working; mark it obsolete with a comment pointing at slice 11.
  6. `/api/me` adds `capabilities`; the e2e fake adds the same field from the same definitions as data.
  7. Regression: the whole backend suite and the Playwright suite pass unchanged.

Notes for the implementer:

- Do not change the shape of `/api/me` `roles` yet; the frontend still reads role names until slice 12.

## Phase 3: Estimate and alignment (`estimating-designs`)

- Update `docs/estimates/organisations.md` (and the subsystem tables of the features this slice changed) to the true
  percent complete of each design this slice touched, and refresh the root `docs/estimates/README.md`.
- Keep the mocks, design system, `docs/screen-composition.md`, the designs and the e2e fake aligned with what was
  built. Tick this slice in the status column of `docs/prompts/README.md`.

## Done means

- Roles are data: the nine FaithTech definitions exist, every assignment and share audience references one, and each request carries a computed capability set; behaviour is unchanged.
- FaithTech behaves exactly as before for every role: every existing backend test and Playwright spec passes
  unchanged, except where this slice's requirements rewrite the behaviour.
- All new and existing tests pass, lint and format are clean, and the documentation agrees with the code.
- The work is on the branch above with a pull request to `main`, and its checks are green. Fetch and rebase
  first.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and anything
  deferred.
