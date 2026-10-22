# AGENTS.md

## Project overview

FaithTech Community is a full-stack community site for FaithTech staff, leads, volunteers, builders, event attendees and partners. Anyone can sign up and create a profile. The .NET backend owns persistence, permissions and authentication; the Angular frontend provides the app; Playwright covers end-to-end behavior and accessibility.

`idea.txt` is the original brief. `decisions.txt` holds the agreed decisions and wins where the two differ.

## Repository layout (MANDATORY)

**This folder structure MUST be followed. It is a mandate, not a suggestion.**

- Every file MUST go in the folder this tree assigns it. If no folder fits, stop and ask; do not guess or improvise.
- Do NOT create top-level folders, projects, libraries or alternative layouts that are not in this tree.
- Do NOT move, rename or merge folders or projects in this tree.
- The tree changes only with the user's explicit approval, and this section MUST be updated in the same change, before any code is placed in the new location.
- Work that does not follow this structure is incomplete and MUST be corrected before it is considered done.

```text
faithtech-community/
├── AGENTS.md, CLAUDE.md, GEMINI.md   # Agent instructions (AGENTS.md is the source of truth)
├── README.md                         # Product overview, setup and development commands
├── LICENSE                           # MIT
├── CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, SUPPORT.md   # Community health files
├── idea.txt, decisions.txt           # Original brief and agreed decisions
├── .github/
│   ├── workflows/                    # CI: build, test, lint, format, container image publish
│   ├── ISSUE_TEMPLATE/               # Bug report and feature request templates
│   ├── pull_request_template.md      # PR checklist
│   └── copilot-instructions.md       # Pointer to AGENTS.md
├── backend/                          # .NET solution
│   ├── FaithTech.Community.sln
│   ├── Directory.Build.props         # Shared build settings for every project
│   ├── Directory.Packages.props      # Central NuGet package versions
│   ├── global.json                   # Pinned .NET SDK
│   ├── deploy/                       # Dockerfiles (API with both Angular builds, Cli) and the
│   │                                 # local compose file (ADR 0026)
│   ├── src/
│   │   ├── FaithTech.Community.Domain/          # Entities, value objects, roles. Zero dependencies.
│   │   │                                        # One folder per feature, named as in Application/,
│   │   │                                        # plus Agile/ for the agile workspace designs
│   │   ├── FaithTech.Community.Application/     # Handlers, validators, DTO contracts, permission
│   │   │                                        # checks; one folder per feature (Identity/,
│   │   │                                        # Profiles/, Contacts/, Partners/, Team/, Events/, Search/,
│   │   │                                        # Notifications/, Announcements/, Invites/, Admin/,
│   │   │                                        # Resources/, Notes/, Agile/, PrivatePreview/, Reports/)
│   │   ├── FaithTech.Community.Infrastructure/  # DbContext, EF migrations, Postgres full-text
│   │   │                                        # search, Azure Blob, email, .ics, CSV, image resizing,
│   │   │                                        # OpenIddict stores, audit log, seeder, private-preview
│   │   │                                        # passphrase hashing and unlock signing
│   │   ├── FaithTech.Community.Api/             # Endpoints, Program.cs, DI composition,
│   │   │                                        # middleware. No business logic.
│   │   └── FaithTech.Community.Cli/             # Database migrate, seed and reset commands
│   └── tests/
│       ├── FaithTech.Community.Application.Tests/     # Handler and authorization rule tests
│       ├── FaithTech.Community.Infrastructure.Tests/  # Persistence, search, storage, email
│       ├── FaithTech.Community.Api.Tests/             # Integration tests against the API
│       └── FaithTech.Community.Cli.Tests/             # CLI command tests
├── frontend/                         # Angular workspace
│   ├── angular.json, package.json, eslint.config.js, .prettierrc
│   └── projects/
│       ├── faithtech-community/      # The app: shell, top-level routes that lazy-load the
│       │                             # feature libraries, auth guards. No feature pages.
│       ├── marketing/                # Second application: the public marketing page served at
│       │                             # www.faithtech.community (sign in, sign up, Google, brochure
│       │                             # video in public/). Composes components and api only (ADR 0018)
│       ├── api/                      # API client library: service contracts, injection
│       │                             # tokens, HTTP implementations, OIDC + PKCE auth
│       ├── components/               # Shared accessible UI component library and design tokens
│       ├── profiles/                 # Feature library: profile pages, photos, dialogs/
│       ├── contacts/                 # Feature library: private contacts, notes, archive
│       ├── partners/                 # Feature library: partner pipeline Kanban
│       ├── team/                     # Feature library: city team members
│       ├── events/                   # Feature library: events, RSVP, public event page, .ics
│       ├── search/                   # Feature library: global search
│       ├── notifications/            # Feature library: in-app bell and preferences
│       ├── announcements/            # Feature library: compose and read announcements
│       ├── invites/                  # Feature library: send and accept invites
│       ├── admin/                    # Feature library: System Admin roles, suspension, audit log
│       ├── resources/                # Feature library: resources list, resource page, archived view,
│       │                             # add/edit/archive/transfer dialogs
│       ├── notes/                    # Feature library: Docs & notes page list, block page editor,
│       │                             # archived view, share/settings/move/archive/image/link dialogs
│       ├── agile/                    # Feature library: workspaces, backlog, board, sprints,
│       │                             # work items, Planning Poker
│       └── reports/                  # Feature library: the fixed, read-only Reports page for Staff
│                                     # and System Admin (filters, figures, charts, tables, CSV export)
├── e2e/                              # Playwright suite (Chromium only)
│   ├── playwright.config.ts
│   ├── pages/                        # Page objects: one per screen, owning selectors
│   ├── fixtures/                     # Test fixtures, the fake backend (routed API + auth) and seeded data
│   └── tests/                        # Specs by feature (one folder per feature, including reports/),
│                                     # including axe accessibility checks
├── eng/                              # Developer and CI scripts (start stack, run tests, deploy.sh)
│   ├── infra/                        # Infrastructure as code for Azure (Bicep: main.bicep, modules/)
│   └── videos/                       # Journey video recording: PowerShell entry point,
│       │                             # Playwright recording config, presenter and journey stories
│       └── brochure/                 # Marketing brochure video source: script, timed slide deck,
│                                     # build command (ADR 0020)
└── docs/
    ├── specs/                        # L1/L2 requirements with acceptance criteria
    ├── detailed-designs/             # Per-subsystem/feature designs and diagrams
    ├── mocks/                        # Static HTML mocks: the design reference
    ├── design-system/                # Tokens, components and patterns taken from the mocks
    ├── estimates/                    # Effort and percent-complete per design
    ├── videos/
    │   └── journeys/                 # One folder per journey: video.webm, poster.png, captions.vtt, narration.md
    ├── adr/                          # Architecture decision records (NNNN-title.md)
    ├── proposals/                    # Feature proposals: problem, decisions, scope and phases, agreed before specs are written
    └── prompts/                      # Ready-to-run implementation prompts for features
```

Rules (MUST be followed):

- Every feature uses the same name in `Application/`, `frontend/projects/`, `docs/specs/` and `docs/detailed-designs/`. The Agile workspaces subsystem is named `agile` (`Domain/Agile/`, `Application/Agile/`, `frontend/projects/agile/`, `docs/detailed-designs/agile/`; ADR 0010). Reports is named `reports` (`Application/Reports/`, `frontend/projects/reports/`, `docs/detailed-designs/reports/`, `docs/estimates/reports.md`, `e2e/tests/reports/`; ADR 0031); it reads other features' entities and needs no `Domain/Reports/`.
- EF Core migrations live only in `Infrastructure/Persistence/Migrations/` and are applied by the Cli project, never by the API.
- .NET tests live only under `backend/tests/`. Angular unit tests (`*.spec.ts`) sit next to the code they test. Playwright tests live only in `e2e/`.
- Each frontend feature is its own library project under `frontend/projects/<feature>/`, exposing its routes, pages and dialogs through its public API (`public-api.ts`). The app lazy-loads it from the shell.
- `frontend/projects/marketing/` is an application, not a feature library: the public marketing page (`docs/detailed-designs/marketing/`, `docs/estimates/marketing.md`, `e2e/tests/marketing/`). It depends only on `components` and `api`, never on the community app or a feature library, and never calls `HttpClient`. Anything it shares with the community app (the sign-in and sign-up forms) lives in `components` and `api`.
- Feature libraries depend only on `components` and `api`, never on each other or on the app. Anything two features share moves into `components` or `api`.
- Feature pages use components from `components` and services from `api`. They never call `HttpClient` directly.
- Read the relevant ADRs in `docs/adr/` before changing the areas they cover.

## Components library is mandatory (CRITICAL)

**Every UI component defined in the design system (`docs/design-system/`) MUST be built once in `frontend/projects/components/` and reused everywhere. This is not optional.**

- The `components` library is the single home of the design system in code: buttons, inputs, form fields, dialogs, cards, avatars, badges, tables, Kanban columns, toasts, navigation and every other component in `docs/design-system/`, plus the design tokens.
- The app and every feature library MUST compose their screens from `components`. Do NOT build, copy, restyle or wrap a design-system component inside a feature library or the app.
- If a screen needs a component that `components` does not have, add it to `components` first, matching the design system, then use it from the feature. Never create a one-off local version.
- If an existing component is missing a variant or state that the design system defines, extend the component in `components`. Do not override its styles from a feature.
- Feature libraries may contain only feature-specific composition: pages, routes, feature dialogs and the glue between `api` services and `components`. Anything reusable belongs in `components`.
- `components` MUST NOT depend on `api`, the app or any feature library. It contains no business logic and makes no HTTP calls.
- Components in `components` MUST meet WCAG 2.2 AA, read tokens by role and expose the design system's variants, sizes and states through inputs.
- A screen that uses a hand-rolled substitute for a library component is incomplete and MUST be corrected before it is considered done.

## Domain rules (do not break)

- Data is global with no city boundary. **Exception:** private contacts and their notes are visible only to the lead who created them and to System Admin.
- A profile can hold several global roles. New users start with no role.
- City Leads may add/remove Lead, Volunteer, Product Engineer and Attendee roles. Only System Admin grants or removes City Lead, Staff and System Admin.
- Staff is read-only across everything except private contacts and the resources and note pages Staff own: Staff may add resources and note pages and edit, share, archive and restore their own; every other Staff write is refused.
- System Admin can override anything; every admin action goes to the audit log.
- Profiles are visible to signed-in members only. Public events are the only content anonymous visitors see (shareable page, guest RSVP, `.ics`).
- Every query, search result and endpoint must enforce these permissions on the server. Never rely on the UI to hide data.

v1 features: profiles and photos (max 10, one featured, alt text required), invites (expire after 14 days), connect links (a City Lead's reusable QR code that never expires and can be replaced; not an invite), contacts (soft-delete archive and restore, linked when the person signs up), partner Kanban (Lead -> In Funnel -> Confirmed), team, events (hackathon is an event type), global search, notifications (in-app + email), announcements (with email opt-out), resources (uploads and https links, type and tags, private/shared/global visibility, archive with 30-day purge), docs & notes (block-based pages with formatting, drag-and-drop and keyboard reorder, page links, backlinks and nesting; private/shared/global visibility, default private; archive and restore). Hackathon teams, projects and judging are v2. Do not build them yet.

## Backend architecture

Stack: .NET (LTS), ASP.NET Core, EF Core, PostgreSQL (full-text search for global search). Identity is ASP.NET Identity + OpenIddict (OAuth2 authorization code + PKCE); passwords are hashed by Identity, and email verification and password reset are required. Photos go to Azure Blob storage, email goes via SMTP/SendGrid, and deployment is containerized.

Layer dependency direction (strict):

- `FaithTech.Community.Domain`: entities, value objects, roles. Zero dependencies.
- `FaithTech.Community.Application`: handlers, validators, DTO contracts, permission checks.
- `FaithTech.Community.Infrastructure`: DbContext, migrations, Postgres, blob storage, email, auth services, seeder.
- `FaithTech.Community.Api`: endpoints, `Program.cs`, DI composition, middleware.
- `FaithTech.Community.Cli`: database migration, seeding and reset commands.

Non-obvious rules:

- Business rules live in Application handlers and domain services, never in endpoints or controllers.
- The API does **not** apply EF Core migrations on startup. Run them explicitly with the Cli project.
- Seed data is idempotent and safe to re-run.
- Endpoints require authentication by default. Anonymous access, such as public event pages and guest RSVP, must be opted into explicitly per endpoint.
- Keep request logging outside the exception-handling middleware so handled response statuses are logged correctly.
- While `PrivatePreview:Enabled` is on (the default; Development turns it off), `PrivatePreviewGateMiddleware` refuses every request without a valid unlock before routing, authentication and static files (ADR 0026). Keep it ahead of them in `Program.cs`. It is a gate in front of the permission rules, never a replacement for them.
- Keep secrets out of the repo; use configuration and environment variables.

### Tests

Backend behavior is covered by integration tests against the API. Write tests for authorization rules alongside each feature, especially private-contact visibility and role-assignment limits.

All backend tests MUST use a fake database: the EF Core in-memory provider, with a uniquely named database per test fixture. Tests MUST NOT depend on Docker, Testcontainers, a running PostgreSQL or any other external service; fake external dependencies (blob storage, email, breached-password checks, time) behind their abstractions.

## Frontend architecture

### Conventions enforced across the codebase

- Prettier owns formatting and angular-eslint owns lint; CI fails on either.
- WCAG 2.2 AA on every screen: keyboard reachable, visible focus, labelled controls, sufficient contrast.
- Read design tokens by role (for example `var(--color-brand-foreground)`), never as hex values.
- Keep component styles encapsulated; global styles are limited to shared foundations and utilities.
- Declare each `ng-content` slot once. A component that renders `<a>` or `<button>` conditionally puts its slots in one `<ng-template>` and renders it with `ngTemplateOutlet` in both branches.
- API services have a contract and an injection token; pages depend on the token, not the concrete implementation.
- No inline forms in pages. Button-triggered editing opens an Angular CDK Dialog or navigates to a screen.
- Use Angular CDK Dialog/Overlay for modal behavior; never hand-roll modals.

## E2E architecture (Playwright)

- Use the Page Object Model. Each screen has one page object, which owns its selectors and interactions. Tests state intent; page objects know the DOM. Never put a selector in a test.
- Run frontend tests in Chromium only. Do not configure or run Firefox, WebKit or any other browser.
- Run axe accessibility checks on every screen.
- Journey demo videos (`docs/videos/journeys/`) are recorded by `pwsh eng/videos/Record-JourneyVideos.ps1`. Their stories reuse `e2e/pages/` and `e2e/fixtures/`, but they are recordings, not tests: keep them out of `e2e/tests/` and the acceptance run. Re-record a journey when its screens change.

### The backend is faked (MANDATORY)

**The full Playwright suite MUST pass with no backend running.** No API, no PostgreSQL, no identity server, no blob storage, no SMTP and no Docker. The suite exercises the real Angular app against a fake backend that the tests own.

- Every HTTP call the app makes is intercepted with Playwright route handling (`page.route` / `context.route`) and answered by a fake API implemented in `e2e/fixtures/`. The fake owns an in-memory data set, seeded per test, and answers the same contracts the real API exposes (status codes, response shapes, validation errors, permission failures).
- Authentication is faked too: the fake API answers the OIDC discovery, authorization, token and userinfo requests so the app completes its real sign-in flow against the fake. Tests sign in as a role (System Admin, City Lead, Staff, Volunteer, anonymous visitor) through a fixture, never by hand-editing storage or bypassing the app's auth code.
- Fake behavior lives in `e2e/fixtures/`, never in page objects or specs. A spec arranges state through a fixture, drives the app through page objects and asserts what the user sees.
- A request the fake does not recognise MUST fail the test loudly (an unrouted request is a bug, not a pass-through). Never let a request fall through to a real network.
- Every test runs as the owner who has already unlocked the private-preview wall; a spec puts the visitor in front of it with `api.wall.lock()` (`e2e/fixtures/mock-wall.ts`, which renders the API's own `wall.html`).
- Playwright's `webServer` starts only the Angular app. It MUST NOT start the API, the Cli project, a database or any container.
- A spec that needs the real backend, a seeded database or any external service is out of scope for `e2e/`; that behavior belongs in the backend integration tests under `backend/tests/`.
- Keep the fake in step with the API: when an endpoint, DTO or permission rule changes, update the fake in the same change so the e2e suite reflects the real contract.

## Incremental implementation and ATDD (MANDATORY)

Mocks and the design system are design artifacts. ATDD does not apply to them; do not write tests for mocks or the design system.

Every new feature or change to production behavior MUST have a requirement (`docs/specs/`), a detailed design (`docs/detailed-designs/`) and a mock (`docs/mocks/`) before implementation begins. This includes behavior changes to existing features. Documentation-only, design-system-only, mock-only and test-only changes are out of scope unless they are part of a production behavior change.

Every production behavior implementation MUST invoke and follow the `implementing-incrementally` skill before any code is written, combined with acceptance test-driven development:

1. Plan small, reviewable slices and complete one at a time.
2. For each slice, write Given-When-Then acceptance criteria, write the acceptance test, and run it to prove it fails for the expected reason BEFORE writing production code.
3. Implement only what satisfies that slice, refactor with tests green, and run the relevant regression checks.
4. Do not move to the next slice until those checks pass.

No bulk implementation, no tests added afterward, and no weakening tests to manufacture a pass. Keep the requirement, design, mock, criteria, tests and implementation aligned until the feature is complete. Keep changes small and match the existing code style.

### Never write architecture tests

Never add a test that asserts the shape of the codebase rather than its behavior: no structure, layout or naming tests, no banned-API scans, and no traceability tests that parse the specifications. Those constraints belong to the compiler, the formatter and review. A test suite exists to prove behavior.
