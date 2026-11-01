# Feature: Create an event hub

Journey 41 of `docs/journeys.md`, slice 41 of the event hubs plan (`docs/prompts/README.md`, "Event hubs").

## Goal

A holder of the new `ManageEventHubs` capability opens an event's page (`frontend/projects/events/src/lib/pages/`,
the page `e2e/pages/event.page.ts` drives) and selects **Create event hub**. A four-step wizard in a CDK Dialog
("Step 1 of 4", Back, Next, **Save and finish later** on every step) confirms the event, offers the starting points
(only **Blank** is selectable in this slice; the template cards arrive in slice 45 and show as "Coming soon" or are
left out, whichever the mock settles), ticks the sections to include, and ends with **Fill in sections now** or
**Preview**. Drafts save automatically. The result is a Draft hub with its sections, shown on a minimal hub home
(status, link, progress line, one row per section). One hub per event.

This first slice also lays the foundations every later slice uses: the `EventHub` and `HubSection` entities and
migration, the `ManageEventHubs` capability (seeded to City Lead and Event Lead in FaithTech), the hub API and its
e2e fake, and the `-NoCaptions` and `-Music` switches for the journey video recorder. Nothing about existing events
changes.

## Before you start

- Depends on: Nothing in the event hub plan; this is the first prompt. Organisations prompts `00` to `28` are merged to `main`.
- `git fetch origin && git switch main && git pull`, then `git switch -c feature/event-hubs-41-create-an-event-hub`.
- Read `AGENTS.md`, `docs/proposals/event-hubs.md` (the whole proposal: sections, design rules, decisions, data
  model, phases, open questions), `docs/prompts/README.md` (what each earlier event hub slice left in place) and the
  documents listed under "Read first".
- Run the suites once before you change anything, so you know the starting state:
  `dotnet test backend/FaithTech.Community.sln`, `cd frontend && npm run lint && npx prettier --check .` and the
  Angular unit tests, and `cd e2e && npx playwright test`. Fix nothing that is unrelated; note any failure that was
  already there.

## Read first

- `docs/proposals/event-hubs.md`, `docs/journeys.md` rows 41 to 50
- `docs/events/socal-hackathon-2026/index.html` (the hand-made hub this feature replaces)
- `docs/detailed-designs/events/create-and-edit-events/` and `public-events-and-guest-rsvp/`
- `backend/src/FaithTech.Community.Domain/Organisations/Capability.cs`, `backend/src/FaithTech.Community.Infrastructure/Persistence/Seed/FaithTechSeed.cs`
- `frontend/projects/events/`, `e2e/fixtures/mock-events.ts`, `e2e/pages/event.page.ts`
- `docs/design-system/components/` (dialog, progress, checkbox, list), `frontend/projects/components/src/lib/progress/`
- `eng/videos/Record-JourneyVideos.ps1`, `eng/videos/presenter.ts`, `docs/videos/journeys/README.md`, ADR 0020 (brochure video)

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: mocks, design system, requirements, detailed design,
  estimate, incremental ATDD implementation, the narrated demo video, a pull request, green checks and the merge.
  Go through every phase and every slice in one continuous run. Do not pause between phases to report, ask
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
- Merging the pull request is authorised by this prompt, even though every push to `main` deploys to production
  through `.github/workflows/deploy.yml`. Do not run a deploy, change Azure resources or touch production data by
  hand.
- Only stop for a real blocker you cannot resolve yourself, such as missing credentials. If that happens, finish
  everything else first, then report the blocker clearly.
- Keep track of progress (a todo list), so that nothing gets left out after context is summarised.

## Rules (read first, binding)

- Follow `AGENTS.md` exactly, especially:
  - **Repository layout is a mandate.** Event hubs extend the `events` feature; they are not a new subsystem.
    Code goes in `Domain/Events/`, `Application/Events/`, `frontend/projects/events/` and `e2e/tests/events/`;
    designs in `docs/detailed-designs/events/`; the estimate in `docs/estimates/events.md`. Do not add top-level
    folders, projects or libraries.
  - **The `components` library is mandatory.** Every design-system component (a stepper, a section checklist row, a
    progress line, a QR code, a banner...) is built once in `frontend/projects/components/` and reused. A missing
    component or variant is added there first, matching `docs/design-system/`. Feature libraries depend only on
    `components` and `api`, never on each other, and never call `HttpClient`.
  - **Permissions are capabilities, never role names** (ADR 0033). Handlers check `ICurrentUser.Has(capability)`.
    FaithTech's role names, templates and default text live only in the seed (`L2-151`). A caller without the
    capability gets 403; `AdministerOrganisation` may override, and every override, publish and unpublish is
    audited.
  - **The host decides the organisation** (ADR 0032). Every hub, section and template belongs to one organisation
    and is filtered by the DbContext's global query filter. An id from another organisation is 404. Chapters tag
    and filter; they never hide (ADR 0034).
  - Public content: anonymous visitors see a hub only when its event is public and the hub is published. Opt the
    endpoint into anonymous access explicitly; the server enforces visibility on every read.
  - Business rules live in Application handlers and Domain, never in endpoints. Section content is JSON validated
    against the section kind's schema in Application.
  - EF Core migrations live only in `backend/src/FaithTech.Community.Infrastructure/Persistence/Migrations/` and are
    applied by the Cli, never by the API. Seed data is idempotent.
  - Backend tests live under `backend/tests/`, use the EF Core in-memory provider with a uniquely named database per
    fixture, and never need Docker, PostgreSQL or any external service. Arrange callers by capability set, use the
    FaithTech seed as the regression case, and test organisation isolation for every new query.
  - Playwright: Chromium only, Page Object Model (selectors only in `e2e/pages/`), fake backend only (fake behaviour
    in `e2e/fixtures/`, for example a `mock-event-hubs.ts` beside `mock-events.ts`; an unrouted request fails the
    test), axe checks on every screen. Keep the fake in step with every endpoint, DTO and permission rule you
    change, in the same change.
  - Frontend: Prettier and angular-eslint must pass; WCAG 2.2 AA; tokens by role, never hex; CDK Dialog for every
    wizard and dialog; no inline forms in pages; API services have a contract and an injection token. Every wizard
    and quick edit works at phone width.
  - The proposal's ten "Design rules that keep it easy" are requirements: one question per step, defaults
    everywhere, nothing required but the event, never retype what the system knows, preview one tap away, plain
    language, validate on the step, save as you go, mobile works, house rules.
  - Never write architecture tests (structure, naming, banned-API or traceability tests).
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Work through the phases below **in order**, using the skill each phase names.
- Copy the house style of each folder. Read the existing neighbours before you write anything new.

## Scope

In scope:

- `EventHub` (Id, OrganisationId, EventId unique, Status Draft or Published, TemplateKey, UpdateBanner,
  PublishedAt, timestamps) and `HubSection` (Id, EventHubId, Kind, Order, Visible, Content JSON) as in the
  proposal's data model; `HubTemplate` waits for slice 45. One migration.
- The `ManageEventHubs` capability in the catalogue (`Domain/Organisations/Capability.cs`), seeded to City Lead and
  Event Lead in `FaithTechSeed.cs`; 403 for callers without it; override audited.
- Create (from the event page), read and save-draft endpoints; the four-step wizard (Blank only); the minimal hub
  home with the section checklist rows (state shown as Needs info, Ready for the system-filled kinds, or Hidden);
  "Create event hub" becomes "Open event hub" once one exists.
- The event's title, date, time, venue, time zone and RSVP link are read from the event, never copied (design
  rule 4).
- Video tooling: `-NoCaptions` and `-Music` switches on `eng/videos/Record-JourneyVideos.ps1` (Phase 5b).
- Open question 1 of the proposal: answer it (default: yes, a chapter-tagged holder may manage hubs for any
  chapter's events, because chapters never hide) and record the answer in the design and the proposal.

Deferred: section wizards (42), preview and publish (43), the public page (44), templates and copy (45), the
hackathon sections (46), template editing (47), quick edits (48), QR share (49), archive (50).

## Phase 1: Mocks (`writing-html-mocks`)

- Add or update mocks in `docs/mocks/` for every screen, wizard step and dialog in scope, in every state (default,
  empty, busy "Saving…", invalid, failed with "Try again", success toast, forbidden, and the others the scope
  names), light and dark, at phone, tablet and desktop widths, with real copy. Use the SoCal hub
  (`docs/events/socal-hackathon-2026/index.html`) as the content reference.
- Update `docs/mocks/manifest.json`, the gallery in `docs/mocks/index.html` and the coverage matrix in
  `docs/mocks/README.md`.

## Phase 2: Design system and screen composition (`extracting-design-systems`, `writing-screen-composition`)

- Add or extend component pages in `docs/design-system/components/` for every component this slice needs that the
  design system does not document yet, with every variant, size and state, WCAG 2.2 AA notes, tokens and code.
  Change tokens only if a new value is needed.
- Update `docs/screen-composition.md` for every new and changed screen.

## Phase 3: Requirements (`writing-requirements`)

- Add L2 requirements under the Events L1 (`L1-008`) in `docs/specs/L2.md`, numbered from the next free number
  after the last one in the file, with Given/When/Then acceptance criteria for everything in scope, including
  validation, the 403 for a caller without the capability, organisation isolation and anonymous visibility.
- Cross-reference the requirements that already exist (the Events group, `L2-145` event types, `L2-151` the
  FaithTech seed, and the event hub requirements earlier slices added) instead of copying them.

## Phase 4: Detailed design (`writing-design-documents`)

- Add `docs/detailed-designs/events/create-event-hub/` in the house style of its neighbours (for example
  `docs/detailed-designs/events/create-and-edit-events/`): backend, data, API contract, frontend, e2e fake, with
  rendered C4, class and sequence diagrams. Record real decisions in an ADR in `docs/adr/` (next free number).
- Update the earlier event hub designs only where this slice changes them.

## Phase 5: Estimate (`estimating-designs`)

- Add the design to `docs/estimates/events.md` at 0% and refresh `docs/estimates/README.md`. Update it again to
  the true percent when the work is done.

## Phase 5b: Journey video tooling: no captions, with music (`recording-demo-videos`)

- Add two switches to `eng/videos/Record-JourneyVideos.ps1`, defaulting to off so every existing journey records
  exactly as before:
  - `-NoCaptions`: the presenter shows no on-screen caption (pass the choice to `eng/videos/presenter.ts` through
    the recording config), and no `captions.vtt` is written or copied. Chapters stay in the WebM.
  - `-Music`: mixes a quiet instrumental bed under the narration, faded in and out, ducked under the voice (for
    example ffmpeg `sidechaincompress` or a fixed gain well below the narration), cut to the video's length.
- The music must be safe to publish: either an original bed generated by the script (for example with ffmpeg's
  audio sources) or a CC0 track committed beside the recorder with its source and licence noted. Record the choice,
  the level and the ducking in a new ADR, and update the `eng/videos/` line of the `AGENTS.md` layout tree in the
  same change if a new file or folder lands there.
- Keep the existing audibility check working with music: every narration paragraph must still be audible.
- Add an "Event hubs" section to `docs/videos/journeys/README.md`, saying these journeys are narrated with music and
  without captions, with `narration.md` as the transcript.

## Phase 6: Incremental implementation (ATDD)

- Invoke the `implementing-incrementally` skill before writing any code, and follow it with ATDD.
- Plan thin vertical slices, for example (adjust them if the code says otherwise):
  1. Capability `ManageEventHubs`, the FaithTech seed grant, entities, migration and the create endpoint (one hub
     per event; 403 without the capability; 404 across organisations), with Api tests.
  2. Read and save-draft endpoints with the section list; autosave semantics; organisation isolation test.
  3. `components`: the stepper (and anything else missing) with its unit tests.
  4. The e2e fake for hubs, and the wizard dialog from the event page (Blank only), with a Playwright spec and axe.
  5. The minimal hub home with checklist rows and "Open event hub" on the event page.
  6. No new code: Phase 5b already added the recorder switches; Phase 7 proves them by recording this journey.
- For each slice:
  - Write the Given-When-Then criteria, taken from the new L2 acceptance criteria.
  - Write the acceptance test first: an Api integration test in `backend/tests/FaithTech.Community.Api.Tests/` (or
    an Application or Infrastructure test where the behaviour lives there), and a Playwright spec in
    `e2e/tests/events/` through page objects, with axe, when the slice changes what someone sees. Name the
    requirement and criterion in the test name or a comment.
  - Run it and show that it fails for the expected reason.
  - Implement the minimum that makes it pass, and refactor while the tests are green.
  - Run the regression checks (the whole backend suite, lint and format, the Angular unit tests, and the
    Playwright specs for every feature the slice touched), then commit with a message that says what changed and
    why.
- When all slices are green, update the estimate to its true percent complete and keep the mocks, design system,
  screen composition, designs and e2e fake aligned with what was built.

## Phase 7: Narrated demo video, no captions, with music (`recording-demo-videos`)

- Add the journey story `eng/videos/journeys/create-event-hub.story.ts`, reusing `e2e/pages/` and `e2e/fixtures/` like its
  neighbours (for example `eng/videos/journeys/create-and-edit-events.story.ts`). It is a recording, not a test:
  keep it out of `e2e/tests/`.
- Write `docs/videos/journeys/create-event-hub/narration.md` in the house format (`# Title`, then `## step-id: Chapter`
  and one plain-spoken paragraph per step). Show the journey end to end as a chapter lead would live it, in about
  one to two minutes. Add any new name to `docs/videos/journeys/pronunciations.json`.
- Record it with `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey create-event-hub -NoCaptions -Music` (the switches
  slice 41 adds). The video has the edge-tts voice narration and a quiet music bed under it, and no on-screen
  captions and no `captions.vtt`.
- Check the result yourself: `video.webm`, `poster.png` and `narration.md` exist; every paragraph is audible
  over the music; no frame shows a caption; the screens match the mocks.
- Add a row to the "Event hubs" table in `docs/videos/journeys/README.md` (video, poster, narration, length, and
  the rerun command with `-NoCaptions -Music`).

## Phase 8: Pull request and merge

- Set row 41 of `docs/journeys.md` to its true completion, and change row 41 in `docs/prompts/README.md` to
  "Done".
- `git fetch origin && git rebase origin/main`, run every suite again, then push and open a pull request to
  `main` with `gh pr create`: what was built, the requirements it satisfies, the decisions made, the video's
  path, and anything deferred.
- Watch the checks with `gh pr checks --watch`. Fix every failure at its root and push again until all are green.
- Merge it with `gh pr merge --merge --delete-branch` (the repository merges with merge commits), then
  `git switch main && git pull`.

## Done means

- A holder of `ManageEventHubs` creates a Draft hub for an event through the four-step wizard and lands on its hub
  home; a caller without it gets 403 and sees no "Create event hub"; another organisation's hub is 404.
- The recorder supports `-NoCaptions` and `-Music`, and existing journeys record unchanged without them.
- FaithTech behaves exactly as before for every existing journey: every existing backend test and Playwright spec
  passes unchanged.
- All new and existing tests pass, lint and format are clean, and the mocks, design system, requirements, design,
  estimate, e2e fake and `docs/journeys.md` agree with the code.
- `docs/videos/journeys/create-event-hub/` holds the narrated, captionless video with music, its poster and its narration,
  and the journeys README lists it.
- The pull request is merged to `main` with every check green, and your local `main` is up to date.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and anything
  deferred.
