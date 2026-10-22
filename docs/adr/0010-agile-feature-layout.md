# 0010. Agile feature layout

- Status: Accepted
- Date: 2026-10-21
- Requirements: L1-012, L1-013, L2-031 to L2-038, L2-050, L2-051
- Designs: `docs/detailed-designs/agile/*`

## Context

The Agile subsystem (workspaces, work items, board, sprints, switch method, archive and transfer, Planning Poker) has requirements, designs, mocks and Domain types in `FaithTech.Community.Domain/Agile/`. The mandatory repository layout in `AGENTS.md` listed no `Agile/` folder in `FaithTech.Community.Application` and no `agile` feature library, and it may only change with explicit approval, recorded before code is placed. The implementation prompt for the subsystem (`docs/prompts/agile-prompt.md`) gave that approval for exactly two additions.

## Decision

- `backend/src/FaithTech.Community.Application/Agile/` holds the Agile handlers, validators, DTOs and the shared `WorkspaceAccessPolicy`.
- `frontend/projects/agile/` is a feature library with its own `public-api.ts`, lazy-loaded by the app shell at `/workspaces`, registered in `angular.json`, the workspace `tsconfig.json` paths and the `build:libs` and `test` scripts like the other feature libraries. It depends only on `components` and `api`.
- The feature name is `agile` everywhere: `Domain/Agile/`, `Application/Agile/`, `frontend/projects/agile/` and `docs/detailed-designs/agile/`. `docs/specs/` keeps one L1 and one L2 file, so the name appears there in the requirement titles (L1-012, L1-013).
- No other folder or project was added. Endpoints, the SignalR hub and persistence live in the existing `Api`, `Infrastructure` and `Cli` projects (ADR 0012).

## Consequences

- `AGENTS.md` lists both folders and the naming rule.
- Anything another feature needs from Agile (for example the admin users page linking to a workspace that needs a new owner) goes through `api` contracts and routes, not through the `agile` library.
