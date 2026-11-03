<p align="center">
  <img src="docs/design-system/assets/logo.svg" alt="FaithTech" width="96" height="96">
</p>

# FaithTech Community

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: in development](https://img.shields.io/badge/status-in%20development-orange.svg)](#project-status)
[![Accessibility: WCAG 2.2 AA](https://img.shields.io/badge/a11y-WCAG%202.2%20AA-green.svg)](#accessibility)

FaithTech Community is an open-source, multi-tenant community platform. One deployment hosts many
organisations, each on its own host with its own members, roles, chapters, vocabulary and data.
[FaithTech](https://faithtech.com) is the first organisation, and it is seed data, not code. Anyone can
sign up on an organisation's host and get a profile there. Its staff, leads, volunteers, builders,
event attendees and partners get the tools to run a community: events with public hubs, private
contacts, a partner pipeline, team, resources, docs & notes, Agile workspaces with Planning Poker and
reports.

## Contents

- [Features](#features)
- [Organisations, roles and capabilities](#organisations-roles-and-capabilities)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Documentation](#documentation)
- [Project status](#project-status)
- [Accessibility](#accessibility)
- [Contributing](#contributing)
- [Security](#security)
- [Support](#support)
- [Code of conduct](#code-of-conduct)
- [License](#license)

## Features

| Area | What it does |
|---|---|
| **Organisations** | Each organisation is resolved from its host and sees only its own data. Administrators set the name, the chapter label (City, Campus...), chapters, roles and grant rules, partner stages, event types, resource types and hub templates. Members of several organisations switch between them. Platform operators provision, suspend and lift organisations from the Cli and never read their data. |
| **Marketing page** | A public page at www.faithtech.community with a captioned brochure video, where visitors sign in, sign up or continue with Google and land in the community app. |
| **Identity and account** | Sign up, email verification, sign in and out, password reset and Google sign-in (OAuth2 code + PKCE). Account settings change email and password and sign out everywhere. |
| **Profiles** | Every member has a profile with a name, bio and up to 10 photos (one featured, alt text required). Profiles are visible to signed-in members of the organisation. |
| **Events** | Members-only or public events with a type, chapter, venue and an online/in-person flag. Public events get a shareable page with guest RSVP (no account needed) and an `.ics` download. Cancelling notifies everyone who RSVP'd. Check-in on the day runs from a phone. |
| **Event hubs** | A public hub page for an event, built from sections or a template (including optional hackathon sections), previewed on its public route, published, shared by QR code, quick-edited live and downloaded as a static zip archive. |
| **Contacts** | Private contacts and notes, visible only to the member who created them and an administrator override. When a contact signs up with the same verified email, the creator is notified and can link to the real profile while keeping their notes. Archive and restore. |
| **Partner pipeline** | A Kanban board with one column per organisation stage, moved by drag or keyboard, with an activity timeline, duplicate detection, merge and restore. |
| **Team** | Everyone holding a role, filterable by role and chapter. |
| **Agile workspaces** | Scrum or Kanban workspaces with an Initiative → Epic → Story → Task hierarchy, backlog, board, sprints and live Planning Poker over SignalR. |
| **Resources** | Uploaded files (up to 20 at a time, 100 MB each) or https links, with a type, tags and a visibility: Private, Shared with chosen members and roles, or Global. Sharing notifies each recipient; archived resources are purged after 30 days. |
| **Docs & notes** | Block-based pages with formatting, images, drag-and-drop and keyboard reorder, page links, backlinks and nesting; private (the default), shared or global; archive and restore. |
| **Global search** | People, events, partners, work items, resources, notes and your own private contacts, filtered by what you are allowed to see. |
| **Announcements** | Send to everyone, to holders of a role, or to an event's RSVP list, in-app and by email (with opt-out). |
| **Notifications** | In-app bell plus email for the events that matter, with per-type preferences. |
| **Invites and connect links** | Invite people by email with an optional pre-assigned role; invites expire after 14 days. Holders of `ConnectLink` also have **My QR code**: a reusable link that never expires (and can be replaced) which lets someone they meet join and become their private contact once their email is verified. |
| **Reports** | A fixed, read-only page of figures, charts and tables with filters and CSV export. |
| **Administration** | Suspend members, assign roles, reassign workspace owners, and read the audit log of every override and role change. |

Hackathon teams, projects and judging are planned for v2.

## Organisations, roles and capabilities

Permissions are capabilities, never role names ([ADR 0033](docs/adr/0033-capability-based-authorisation.md)).
The platform defines the capability catalogue; each organisation defines its roles as named bundles
of capabilities, plus grant rules saying which roles may grant which. A profile can hold several
roles, each optionally tagged with a chapter, and new profiles hold no role. Chapters tag and filter;
they never hide anything ([ADR 0034](docs/adr/0034-chapters-are-tags-not-boundaries.md)).

FaithTech's seeded roles are City Lead, Event Lead, Create Lead, Communications Lead, Staff (read-only
by construction), Volunteer, Product Engineer, Attendee and System Admin. A holder of
`AdministerOrganisation` can override anything, every override and role change is audited, and an
organisation always keeps at least one active administrator.

All permissions are enforced on the server, and nothing crosses organisations: an id from another
organisation is not found ([ADR 0032](docs/adr/0032-multi-tenancy-organisation-per-host.md)).

## Architecture

```text
┌─────────────────────┐   OAuth2 code + PKCE    ┌──────────────────────────────┐
│  Angular SPAs       │ ──────────────────────▶ │  ASP.NET Core API            │
│  community app +    │   REST + SignalR        │  organisation per host,      │
│  marketing page     │ ◀────────────────────▶  │  ASP.NET Identity+OpenIddict │
└─────────────────────┘                         └──────┬──────────┬─────────┬──┘
                                                       │          │         │
                                              PostgreSQL     Azure Blob   SMTP /
                                              (EF Core,      (photos,     SendGrid
                                              full-text)     files)       (email)
```

| Layer | Technology |
|---|---|
| Backend | .NET 10 (LTS), ASP.NET Core, EF Core, clean architecture (Domain, Application, Infrastructure, Api, Cli) |
| Identity | ASP.NET Identity + OpenIddict, authorization code + PKCE, email verification, password reset, Google sign-in |
| Tenancy | One organisation per host, resolved by middleware and enforced by a global query filter |
| Data | PostgreSQL with full-text search |
| Real time | SignalR (Planning Poker, live boards) |
| Frontend | Angular 21 workspace: the community app, the marketing app, a shared `components` library, an `api` library and one library per feature |
| Testing | xUnit tests on the EF Core in-memory provider, Angular unit tests, Playwright (Chromium) against a fake backend with axe accessibility checks |
| Hosting | Azure Container Apps behind a private-preview wall, Azure Blob storage, Bicep in `eng/infra/` |

Architecture decisions are recorded in [`docs/adr/`](docs/adr/).

## Repository layout

```text
faithtech-community/
├── backend/          # .NET solution: src/ and tests/
├── frontend/         # Angular workspace: community app, marketing app, components, api and feature libraries
├── e2e/              # Playwright end-to-end and accessibility suite
├── eng/              # Developer and CI scripts, infrastructure as code
└── docs/             # Specs, detailed designs, mocks, design system, estimates, ADRs, journey videos, event material
```

The full, mandatory layout is in [AGENTS.md](AGENTS.md#repository-layout-mandatory).

## Getting started

### Explore the design today

The HTML mocks show every page, dialog and notification in every state, in light and dark themes.

```sh
git clone https://github.com/QuinntyneBrown/faithtech-community.git
cd faithtech-community
# Open the gallery in your browser
start docs/mocks/index.html      # Windows
open docs/mocks/index.html       # macOS
xdg-open docs/mocks/index.html   # Linux
```

### Watch the journeys that work today

Every journey in the [journey catalogue](docs/journeys.md) has a demo video in
[`docs/videos/journeys/`](docs/videos/journeys/README.md). Re-record them with
`pwsh eng/videos/Record-JourneyVideos.ps1`.

### Prerequisites for development

- [.NET SDK](https://dotnet.microsoft.com/download) 10 (pinned in `backend/global.json`)
- [Node.js](https://nodejs.org/) LTS and npm
- [Docker](https://www.docker.com/) for PostgreSQL and Azurite in local development (not needed for tests)
- [Python 3.11+](https://www.python.org/) to run the mock checks

### Build and run

```sh
# Start PostgreSQL and Azurite (blob storage) for development
docker compose -f backend/deploy/compose.yaml up -d postgres azurite

# Apply migrations and seed data (the API never migrates on startup); reset drops and recreates the schema
dotnet run --project backend/src/FaithTech.Community.Cli -- migrate
dotnet run --project backend/src/FaithTech.Community.Cli -- seed
dotnet run --project backend/src/FaithTech.Community.Cli -- reset

# Make an account that has signed up the first System Admin (idempotent, audited)
dotnet run --project backend/src/FaithTech.Community.Cli -- grant-admin you@example.org

# Platform operators (accounts listed in Platform:Operators) provision, suspend and lift organisations and read the platform audit log
dotnet run --project backend/src/FaithTech.Community.Cli -- org create --slug riverside --host app.riverside.org   --name "Riverside Church" --short-name Riverside --admin-email joel@riverside.org --operator you@example.org
dotnet run --project backend/src/FaithTech.Community.Cli -- org suspend riverside --reason "Unpaid since March" --operator you@example.org
dotnet run --project backend/src/FaithTech.Community.Cli -- org lift riverside --operator you@example.org
dotnet run --project backend/src/FaithTech.Community.Cli -- org audit --operator you@example.org

# Run the API
dotnet run --project backend/src/FaithTech.Community.Api

# Isolated performance environment only: 200 verified load-test members, then the k6 run
# (see docs/detailed-designs/platform/performance, "Load test")
LOADTEST_PASSWORD=<12+ characters> dotnet run --project backend/src/FaithTech.Community.Cli -- seed-load-users 200

# Run the Angular app (http://localhost:4200) and the marketing page (http://localhost:4300)
cd frontend && npm ci && npm start
cd frontend && npm run start:marketing

# Google sign-in reads its client from configuration, never the repository
export Google__ClientId=<client id> Google__ClientSecret=<client secret>

# Re-render the marketing page's brochure video (Kokoro-82M from Hugging Face; needs Python 3.10+
# with `pip install kokoro soundfile`; --engine edge or --engine espeak are the alternatives)
PYTHON=.cache/kokoro-venv/bin/python node eng/videos/brochure/build.mjs
```

### Deploy behind the private-preview wall

`app.faithtech.community` and `www.faithtech.community` run as one Azure Container Apps app behind a server-side wall until private preview ends ([ADR 0026](docs/adr/0026-private-preview-wall-and-hosting.md)). The owner's steps, from DNS records to lifting the wall, are in the [runbook](docs/detailed-designs/platform/private-preview-wall/runbook.md).

```sh
# Smoke-test the production images locally with the wall on (passphrase: "local smoke test passphrase")
docker compose -f backend/deploy/compose.yaml up --build --wait   # then open http://www.localhost:8080

# The wall's secrets: a PBKDF2 hash of a passphrase read from standard input, and a signing key
dotnet run --project backend/src/FaithTech.Community.Cli -- wall-hash
dotnet run --project backend/src/FaithTech.Community.Cli -- wall-key

# Deploy (normally run by .github/workflows/deploy.yml); validate the templates without deploying
eng/deploy.sh
az bicep build --file eng/infra/main.bicep && az bicep lint --file eng/infra/main.bicep
```

Development keeps the wall off (`PrivatePreview:Enabled` is `false` in `appsettings.Development.json`).

### Test

No test needs Docker, a database or a running backend: backend tests use the EF Core in-memory
provider, and the Playwright suite runs the real Angular app against a fake backend in
`e2e/fixtures/` (its `webServer` starts only the Angular app).

```sh
dotnet test backend/FaithTech.Community.sln          # backend handler, persistence, API and Cli tests
cd frontend && npm test                               # Angular unit tests for every project
cd frontend && npm run lint && npm run format:check   # angular-eslint and Prettier (CI fails on either)
cd e2e && npm ci && npx playwright test               # end-to-end and axe checks (Chromium)
```

CI (`.github/workflows/`) builds and tests the backend and frontend on every change, and
`deploy.yml` publishes the container images and deploys.

## Documentation

| Document | Purpose |
|---|---|
| [`docs/specs/`](docs/specs/) | L1/L2 requirements with acceptance criteria |
| [`docs/detailed-designs/`](docs/detailed-designs/) | Per-feature designs and diagrams |
| [`docs/mocks/`](docs/mocks/README.md) | Static HTML mocks: the design reference, with a coverage matrix |
| [`docs/design-system/`](docs/design-system/README.md) | Tokens, components and patterns extracted from the mocks |
| [`docs/adr/`](docs/adr/) | Architecture decision records |
| [`docs/estimates/`](docs/estimates/README.md) | Effort, percent complete, visual conformance and roadmap per subsystem |
| [`docs/journeys.md`](docs/journeys.md) | User journeys, ordered by value, with effort and completion |
| [`docs/videos/journeys/`](docs/videos/journeys/README.md) | Demo videos of every journey |
| [`docs/events/`](docs/events/) | Real event material kept for the record |
| [AGENTS.md](AGENTS.md) | Conventions for contributors and coding agents |

## Project status

| Milestone | Status |
|---|---|
| Product brief and decisions | ✅ Done |
| Multi-tenancy design (organisations, capabilities, chapters, taxonomies) | ✅ Done |
| HTML mocks for every screen and state | ✅ Done |
| Requirements (`docs/specs/`) | ✅ Done |
| Detailed designs and design system | ✅ Done |
| v1 implementation | 🚧 97% of 428 days ([estimates](docs/estimates/README.md)): profiles, invites, contacts, partners, team, events and event hubs, notifications, announcements and reports are complete; identity, admin, Agile, resources, notes, organisations, the marketing page and search are 90–99%; platform is at 84%, with deployment behind the private-preview wall next |
| Visual conformance with the mocks | 🚧 Graded per journey (B to A+) in the [estimates](docs/estimates/README.md) |
| v2: hackathon teams, projects and judging | 🗓️ Later |

## Accessibility

Every screen targets [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/): keyboard reachable, visible focus,
labelled controls, sufficient contrast in light and dark themes, and alt text on every photo.
Automated axe checks run on every screen in the end-to-end suite. Accessibility bugs are treated as
bugs, not enhancements.

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for how to report issues,
propose changes, and the spec → design → mock → test-first workflow every behavior change follows.

## Security

Please do **not** report security vulnerabilities through public GitHub issues. See
[SECURITY.md](SECURITY.md) for how to report them privately.

## Support

See [SUPPORT.md](SUPPORT.md) for how to get help and where to ask questions.

## Code of conduct

This project has adopted the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree
to uphold it.

## License

Licensed under the [MIT License](LICENSE).

## Trademarks

"FaithTech" and related names and logos may be trademarks of their respective owners. This license
does not grant permission to use them. Use of these marks must follow the owner's trademark
guidelines.
