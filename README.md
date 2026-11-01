<p align="center">
  <img src="docs/design-system/assets/logo.svg" alt="FaithTech" width="96" height="96">
</p>

# FaithTech Community

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: in development](https://img.shields.io/badge/status-in%20development-orange.svg)](#project-status)
[![Accessibility: WCAG 2.2 AA](https://img.shields.io/badge/a11y-WCAG%202.2%20AA-green.svg)](#accessibility)

FaithTech Community is an open-source community platform for [FaithTech](https://faithtech.com)
staff, city leads, volunteers, builders, event attendees and partners. Anyone can join and create a
profile. Leads get the tools to run a city: events, private contacts, a partner pipeline, their team
and Agile workspaces with Planning Poker.

> **Project status:** in development. Requirements, designs, mocks and the design system are in place,
> and v1 is being built feature by feature. See [Project status](#project-status).

## Contents

- [Features](#features)
- [Roles](#roles)
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
| **Marketing page** | A public page at www.faithtech.community with a 21-second captioned brochure video, where visitors sign in, sign up or continue with Google and land in the community app. |
| **Profiles** | Every member has a profile with a name, bio and up to 10 photos (one featured, alt text required). Profiles are visible to signed-in members. |
| **Events** | Members-only or public events with city, venue and an online/in-person flag. Public events get a shareable page with guest RSVP (no account needed) and an `.ics` download. Cancelling notifies everyone who RSVP'd. Hackathons are an event type. |
| **Contacts** | Leads keep private contacts and notes, visible only to them and System Admin. When a contact signs up with the same verified email, the lead is notified and can link to the real profile while keeping their notes. Archive and restore. |
| **Partner pipeline** | One shared Kanban board for all leads: Lead → In Funnel → Confirmed, moved by drag or keyboard with each move recorded. Staff see it read-only. |
| **Team** | Everyone holding a lead or volunteer role. |
| **Agile workspaces** | City Leads create Scrum or Kanban workspaces for their leads and volunteers, with an Initiative → Epic → Story → Task hierarchy, sprints and live Planning Poker. |
| **Resources** | Decks, logos, images, training and templates as uploaded files (up to 20 at a time, 100 MB each) or https links, with a type, tags and a visibility: Private, Shared with chosen members and roles, or Global. Sharing notifies each recipient; archived resources are purged after 30 days. |
| **Global search** | People, events, partners, work items, resources and your own private contacts, filtered by what you are allowed to see. |
| **Announcements** | Send to everyone, to holders of a role, or to an event's RSVP list, in-app and by email (with opt-out). |
| **Notifications** | In-app bell plus email for the events that matter. |
| **Invites** | Leads invite people by email with an optional pre-assigned role. Invites expire after 14 days. City Leads also have **My QR code**: a reusable link that never expires (and can be replaced) which lets someone they meet join and become their private contact automatically once their email is verified. |
| **Administration** | System Admins suspend users, assign any role, reassign workspace owners, and every admin action is written to an audit log. |

Hackathon teams, projects and judging are planned for v2.

## Roles

A profile can hold several global roles at once. New members start with no role.

| Role | Can do |
|---|---|
| **City Lead** | Contacts, partners, team, Agile workspaces, resources, invites and role assignment (except City Lead, Staff and System Admin) |
| **Event Lead** | Events |
| **Create Lead** | Hackathon builders and projects |
| **Communications Lead** | Announcements |
| **Volunteer**, **Product Engineer**, **Attendee** | Community membership; volunteers can be added to Agile workspaces |
| **Staff** | Read-only view of everything except private contacts; may add resources and edit, share, archive and restore their own |
| **System Admin** | Full override, including private contacts; every action is audited |

All permissions are enforced on the server.

## Architecture

```text
┌─────────────────────┐   OAuth2 code + PKCE    ┌──────────────────────────────┐
│  Angular SPA        │ ──────────────────────▶ │  ASP.NET Core API            │
│  app shell +        │   REST + SignalR        │  ASP.NET Identity +          │
│  feature libraries  │ ◀────────────────────▶  │  OpenIddict                  │
└─────────────────────┘                         └──────┬──────────┬─────────┬──┘
                                                       │          │         │
                                              PostgreSQL     Azure Blob   SMTP /
                                              (EF Core,      (photos)     SendGrid
                                              full-text)                  (email)
```

| Layer | Technology |
|---|---|
| Backend | .NET (LTS), ASP.NET Core, EF Core, clean architecture (Domain, Application, Infrastructure, Api, Cli) |
| Identity | ASP.NET Identity + OpenIddict, authorization code + PKCE, email verification, password reset |
| Data | PostgreSQL with full-text search |
| Real time | SignalR (Planning Poker, live boards) |
| Frontend | Angular workspace: one app shell, a shared `components` library, an `api` library and one library per feature |
| Testing | xUnit integration tests, Angular unit tests, Playwright (Chromium) with axe accessibility checks |
| Hosting | Containers, Azure Blob storage, infrastructure as code in `eng/infra/` |

Architecture decisions are recorded in [`docs/adr/`](docs/adr/).

## Repository layout

```text
faithtech-community/
├── backend/          # .NET solution: src/ and tests/
├── frontend/         # Angular workspace: community app, marketing app, components, api and feature libraries
├── e2e/              # Playwright end-to-end and accessibility suite
├── eng/              # Developer and CI scripts, infrastructure as code
├── docs/             # Specs, detailed designs, mocks, design system, estimates, ADRs, videos
├── idea.txt          # Original product brief
└── decisions.txt     # Agreed product decisions (win over idea.txt)
```

The full, mandatory layout is in [AGENTS.md](AGENTS.md#repository-layout-mandatory).

## Getting started

### Explore the design today

The HTML mocks show every page, dialog and notification in every state, in light and dark themes.

```sh
git clone https://github.com/<org>/faithtech-community.git
cd faithtech-community
# Open the gallery in your browser
start docs/mocks/index.html      # Windows
open docs/mocks/index.html       # macOS
xdg-open docs/mocks/index.html   # Linux
```

### Watch the journeys that work today

Narrated demo videos of sign up, email verification, sign in and out, password reset, the app
shell, the error pages and member profiles (view, edit and photos) are in [`docs/videos/journeys/`](docs/videos/journeys/README.md). Regenerate
them all with `pwsh eng/videos/Record-JourneyVideos.ps1`.

### Prerequisites for development

When the application code lands you will need:

- [.NET SDK](https://dotnet.microsoft.com/download) (LTS; pinned in `backend/global.json`)
- [Node.js](https://nodejs.org/) LTS and npm
- [Docker](https://www.docker.com/) for PostgreSQL and local services
- [Python 3.11+](https://www.python.org/) to run the mock checks

### Build and run (planned)

```sh
# Start PostgreSQL and Azurite (blob storage) for development
docker compose -f backend/deploy/compose.yaml up -d postgres azurite

# Apply migrations and seed data (the API never migrates on startup)
dotnet run --project backend/src/FaithTech.Community.Cli -- migrate
dotnet run --project backend/src/FaithTech.Community.Cli -- seed

# Make an account that has signed up the first System Admin (idempotent, audited)
dotnet run --project backend/src/FaithTech.Community.Cli -- grant-admin you@example.org

# Platform operators (accounts listed in Platform:Operators) provision an organisation and read the platform audit log
dotnet run --project backend/src/FaithTech.Community.Cli -- org create --slug riverside --host app.riverside.org   --name "Riverside Church" --short-name Riverside --admin-email joel@riverside.org --operator you@example.org
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

### Test (planned)

```sh
dotnet test backend/FaithTech.Community.sln   # backend unit and integration tests
cd frontend && npm test                        # Angular unit tests
cd e2e && npx playwright test                  # end-to-end and axe checks (Chromium)
```

Exact commands will be kept up to date here as each part of the stack is added.

## Documentation

| Document | Purpose |
|---|---|
| [`idea.txt`](idea.txt) | The original product brief |
| [`decisions.txt`](decisions.txt) | Agreed product and technical decisions |
| [`docs/mocks/`](docs/mocks/README.md) | Static HTML mocks: the design reference, with a coverage matrix |
| `docs/specs/` | L1/L2 requirements with acceptance criteria |
| `docs/detailed-designs/` | Per-feature designs and diagrams |
| `docs/design-system/` | Tokens, components and patterns extracted from the mocks |
| [`docs/adr/`](docs/adr/) | Architecture decision records |
| [`docs/videos/journeys/`](docs/videos/journeys/README.md) | Narrated demo videos of the journeys implemented so far |
| [AGENTS.md](AGENTS.md) | Conventions for contributors and coding agents |

## Project status

| Milestone | Status |
|---|---|
| Product brief and decisions | ✅ Done |
| HTML mocks for every screen and state | ✅ Done |
| Requirements (`docs/specs/`) | ✅ Done |
| Detailed designs and design system | ✅ Done |
| v1 implementation | 🚧 97% ([estimates](docs/estimates/README.md)): profiles, admin, invites, contacts, partners, team, events, notifications, announcements, Agile workspaces, resources, the marketing page with Google sign-in and the private-preview wall with its deployment assets are built; search, platform and identity are nearly done |
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
