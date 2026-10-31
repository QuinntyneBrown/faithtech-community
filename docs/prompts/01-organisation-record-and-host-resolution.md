# Feature: Organisation record and host resolution

Slice 01 of the organisations plan (`docs/prompts/README.md`).

## Goal

Introduce the organisation as a tenant and make the request host decide it. After this slice the database holds an
`Organisations` table with the FaithTech row, every request on a known host has an `ICurrentOrganisation`, an unknown
host answers 404 with the neutral unknown-host page, a suspended organisation's host answers 503 with the neutral
suspended page, and `localhost` in Development resolves to `Platform:DefaultOrganisationSlug`. Nothing else is scoped
yet; FaithTech members notice nothing.

## Before you start

- Depends on: Prompt `00` in `docs/prompts/` is merged to `main`. If it is not, stop and say so.
- `git fetch origin && git switch main && git pull`, then `git switch -c feature/organisations-01-organisation-record-and-host-resolution`.
- Read `AGENTS.md`, `docs/proposals/organisations.md`, `docs/prompts/README.md` (the slice plan and what each earlier
  slice left in place) and the documents listed under "Read first".
- Run the suites once before you change anything, so you know the starting state:
  `dotnet test backend/FaithTech.Community.sln`, `cd frontend && npm run lint && npx prettier --check .` and the
  Angular unit tests, and `cd e2e && npx playwright test`. Fix nothing that is unrelated; note any failure that was
  already there.

## Read first

- `docs/detailed-designs/organisations/tenancy-and-host-resolution/README.md` (Domain, Application, Api middleware, `SystemPages`)
- `docs/detailed-designs/organisations/seed-faithtech/README.md` (`FaithTechSeed`, fixed ids)
- ADR 0032, ADR 0026 (the wall and its page), `docs/detailed-designs/platform/private-preview-wall/README.md`
- `backend/src/FaithTech.Community.Api/Program.cs` (middleware order), the private-preview gate middleware and `WallPage`, `e2e/fixtures/mock-wall.ts`
- Mocks `docs/mocks/pages/unknown-host` and `docs/mocks/pages/organisation-suspended`

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

- `L2-131` AC1 (resolution after the wall, before auth, static files and routing), AC2 (unknown host: 404 neutral page for navigations, empty body otherwise, `/health/live` still answers), AC3 (suspended: 503 neutral page; the status is arranged in tests, operators set it in slice 28), AC4 (Development `localhost`), AC5 (only the host decides)
- `L2-151` AC1, the organisation row only: slug `faithtech`, host `app.faithtech.community`, name "FaithTech Community", short name "FaithTech", chapter label City/Cities, Active; idempotent
- `L2-048` for the two neutral system pages

Deferred (do not build here; a later slice owns it):

- Scoping records, filters and stamping (slice 02)
- Copy, titles, email and `.ics` naming (slice 04)
- CORS and static sites per host kind, marketing per host (slice 05)
- Operators suspending and lifting (slice 28)

## Phase 1: Check the design artefacts

The requirements, designs and ADRs already exist, and prompt `00` added the mocks, the design-system changes and
`docs/estimates/organisations.md`. Do not rewrite them. Check that they cover this slice:

- Mocks `pages/unknown-host` and `pages/organisation-suspended` exist and match the neutral wall style.
- The tenancy design's middleware order matches `Program.cs` today; if `UseExceptionHandler` or `UseStatusCodePages` sit elsewhere, update the design's wording to the real order while keeping the rule (after the wall, before static files, CORS, auth and routing).
- The seed-faithtech design names one migration `OrganisationsAndCapabilities`. The plan lands it in several migrations, one per slice that changes the schema. Record that in the seed-faithtech design's Migration section before you generate the first one.
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

  1. `Organisation` aggregate and `OrganisationStatus` in `Domain/Organisations/` with `Rename`, `SetChapterLabel`, `Suspend` and `Lift` (Domain unit tests for the invariants).
  2. `Organisations` table mapping (unique `Slug`, unique `Host` case-insensitive) and the first migration that creates it and inserts the FaithTech row with the fixed id from a new `FaithTechSeed`; `CommunitySeeder` inserts the same row idempotently.
  3. `ICurrentOrganisation`, `IOrganisationResolver` (one indexed query, no cache), `PlatformOptions` (`DefaultOrganisationSlug`, validated on start) and `HttpCurrentOrganisation`.
  4. `OrganisationResolutionMiddleware` in `Api/Middleware/Organisations/` placed right after the wall: known host passes with the organisation in `HttpContext.Items`; `/health/live` passes; Development `localhost` uses the default slug. Api tests for each case.
  5. Unknown host: 404, `unknown-host.html` for `GET`/`HEAD` accepting `text/html`, empty body otherwise, `Cache-Control: no-store`, embedded resource rendered like `WallPage` with a CSP nonce and no product name.
  6. Suspended organisation: 503 with `suspended.html` in the same two forms; no static file, API call or sign-in served.
  7. AC5: a test that a header, query string or token claim naming another organisation changes nothing.
  8. `CommunityApiFactory` resolves its test host to FaithTech so every existing test runs unchanged; the e2e fake gains a way to render the two pages like `mock-wall.ts` (for example `api.host.unknown()`), with one Playwright spec plus axe for each page in `e2e/tests/organisations/`.

Notes for the implementer:

- Keep the health check reachable on every host, as the wall does.
- The marketing host is still recognised by `Marketing:Origin` in this slice; slice 05 moves it to `Marketing:Sites`. Make sure `www.faithtech.community` and the community host both keep working.

## Phase 3: Estimate and alignment (`estimating-designs`)

- Update `docs/estimates/organisations.md` (and the subsystem tables of the features this slice changed) to the true
  percent complete of each design this slice touched, and refresh the root `docs/estimates/README.md`.
- Keep the mocks, design system, `docs/screen-composition.md`, the designs and the e2e fake aligned with what was
  built. Tick this slice in the status column of `docs/prompts/README.md`.

## Done means

- A request on an unknown host gets the neutral 404 page; a suspended organisation's host gets the neutral 503 page; `localhost` in Development is FaithTech; `/health/live` always answers.
- The FaithTech organisation row exists after `migrate` and after `seed`, and a second `seed` changes nothing.
- FaithTech behaves exactly as before for every role: every existing backend test and Playwright spec passes
  unchanged, except where this slice's requirements rewrite the behaviour.
- All new and existing tests pass, lint and format are clean, and the documentation agrees with the code.
- The work is on the branch above with a pull request to `main`, and its checks are green. Fetch and rebase
  first.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and anything
  deferred.
