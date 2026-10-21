# Feature: Implement the Agile workspaces subsystem

## Goal

Build, end to end, the Agile subsystem. Requirements, mocks and detailed designs already exist:

- `docs/detailed-designs/agile/`: `workspaces-and-membership` (L2-031), `work-items` (L2-032, L2-033),
  `board` (L2-034), `sprints` (L2-035), `switch-method` (L2-036), `archive-and-transfer-workspaces` (L2-037),
  `planning-poker` (L2-038).
- Related: L2-026 (work items appear in search only for workspace members, Staff and System Admin), L2-027 and
  L2-028 (assignment, workspace-addition and Planning Poker emails and notifications), L2-041 (audit), L2-042.
- L1-012 (Agile team workspaces) and L1-013 (Planning Poker).

What users get:

- A City Lead creates a Scrum or Kanban workspace and owns it; a City Lead can own several. The owner adds members
  (only profiles holding a lead or volunteer role; each is notified) and removes them (their items become
  unassigned).
- Members create and edit stories and tasks, move cards, comment and vote in Planning Poker. Only the owner
  creates and edits initiatives and epics (Initiative -> Epic -> Story -> Task). Only the owner manages members,
  settings and sprints, switches method, archives and transfers the workspace.
- Board (Scrum and Kanban), backlog, sprints (start and close), switch method, archive and restore (archiving a
  story archives its tasks), ownership reassignment when an owner loses the City Lead role.
- Planning Poker: a member starts a session for one or more stories, invites members (in-app and email), becomes
  facilitator, and stories are estimated one at a time, live.
- Staff can view every workspace but every write returns 403. A non-member who is not Staff or System Admin gets
  404 and sees nothing in search. System Admin can act on any workspace and every action is audited.

Where it lives today (placeholders or partial):

- Backend: Domain `Agile/` (Workspace, WorkspaceMember, WorkspaceMethod, WorkItem, WorkItemKind, WorkItemStatus,
  WorkItemHierarchy, Comment, Sprint, SprintState, PokerSession, PokerVote, DeckValue). Application,
  Infrastructure and Api have no Agile code yet.
- Frontend: no Agile library exists yet (see the layout decision below).
- Mocks: `docs/mocks/pages/{workspaces,backlog,team-board,work-item,planning-poker,workspace-settings}`,
  `docs/mocks/dialogs/{create-workspace,add-workspace-member,remove-workspace-member,new-work-item,archive-work-item,archive-workspace,start-sprint,close-sprint,start-poker}`.
  Note that `team-board` is the Agile board mock, not the team list.
- Estimates: `docs/estimates/agile.md` (seven designs, 36 days, all 0%).

Out of scope: hackathon teams, projects and judging (v2); anything not in the seven designs.

## Layout decision (resolve first, MANDATORY)

`AGENTS.md` lists `Domain/Agile/` but has no `Application/Agile/` folder and no `frontend/projects/agile/` library,
and says the tree changes only with explicit approval and must be updated first. This prompt is that approval, and
only for these additions:

- `backend/src/FaithTech.Community.Application/Agile/` (handlers, validators, DTOs, permission checks).
- `frontend/projects/agile/` as a feature library with `public-api.ts`, lazy-loaded by the app shell, depending
  only on `components` and `api`. Register it in `angular.json`, tsconfig paths and the workspace as the other
  feature libraries are.
- `Agile` in the feature-name rules: use the same name `agile` in `docs/specs/`, `docs/detailed-designs/`,
  `Application/` and `frontend/projects/`.

Before writing any code: edit the repository tree and rules in `AGENTS.md` (and the pointers `CLAUDE.md`,
`GEMINI.md`, `.github/copilot-instructions.md` if they repeat the tree) to add these, and record it in an ADR.
Do not add any other folder.

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: layout update, doc verification, incremental ATDD
  implementation of every slice, green tests and a pull request. Go through every phase and slice in one
  continuous run. Do not pause to report, ask for approval, or wait for "continue".
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
  - Repository layout is mandatory. Apart from the two additions above, no new folders or projects.
  - Components library is mandatory. Board, columns, cards, drag and keyboard move, poker cards and deck, avatars,
    badges, tables, dialogs, forms and toasts come from `frontend/projects/components/`; add anything missing
    there first (a Kanban column and card may already exist from the partners work; reuse them). `agile` depends
    only on `components` and `api`. No inline forms; use CDK Dialog. No direct `HttpClient`; use contracts with
    tokens.
  - Roles and visibility are enforced on the server in every query and endpoint: owner, member, Staff
    (read-only), System Admin (audited), non-member (404).
  - Business rules in Application handlers; endpoints authenticated by default. Live Planning Poker transport
    (for example SignalR) belongs in Api and Infrastructure behind an Application abstraction; record the choice
    in an ADR. Migrations only in Infrastructure, applied by the Cli. Seeds idempotent.
  - Backend tests: EF in-memory provider, unique database per fixture, fakes for email, time and the real-time
    hub. No Docker or Postgres.
  - E2E: Playwright, Chromium only, page objects own selectors, axe check on every screen.
  - Never write architecture tests. Tokens by role, WCAG 2.2 AA (the board must be fully keyboard operable),
    Prettier and angular-eslint pass.
- Invoke and follow the `implementing-incrementally` skill before writing any code.
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Copy the house style of neighbouring code. Read the finished `profiles` feature (backend and frontend) and
  `identity` first and reuse its patterns.

## Phase 1: Check the documentation (no new mocks, specs or designs unless a gap is found)

- Read all seven designs, the Agile mocks, ADRs and `docs/screen-composition.md`. Confirm every state has a mock
  (workspaces list empty, board Scrum and Kanban, forbidden, staff read-only, member, backlog, sprints, poker
  voting and revealed, archived; light, dark, phone, tablet, desktop).
- Fix any gap or contradiction first (skills `writing-html-mocks`, `extracting-design-systems`,
  `writing-requirements` with the next number after L2-054, `writing-design-documents`,
  `writing-screen-composition`). Record real decisions in ADRs.

## Phase 2: Incremental implementation (ATDD)

Plan thin vertical slices (each with backend and frontend acceptance tests). Suggested order:

1. Layout update and ADR (above), then the empty `agile` library wired into the shell and `angular.json`.
2. Workspaces and membership: create (Scrum or Kanban), list, add and remove members (lead or volunteer only,
   notify, unassign on removal), roles matrix (owner, member, Staff 403, non-member 404, System Admin audited).
3. Work items: hierarchy rules, create and edit fields, owner-only initiatives and epics, comments, archive.
4. Board and backlog: columns by status, move cards by drag and keyboard, Scrum and Kanban views.
5. Sprints: start and close, scope rules as designed, sprint view.
6. Switch method: Scrum to Kanban and back, with the data effects the design states.
7. Archive, restore and transfer: archive workspace and items, owner loses City Lead -> System Admin notified and
   reassigns.
8. Planning Poker: start session, invite and notify, vote, reveal, accept estimate, live updates, facilitator
   rules.
9. Search integration: work items searchable only by members, Staff and System Admin (plug into the existing
   search abstraction if present; otherwise record it as deferred).
10. Playwright specs with page objects and axe checks for every screen; idempotent seed data in the Cli.

For each slice:
- Write the Given-When-Then criteria, then the acceptance test traced to its requirement.
- Run it and show it fails for the expected reason before writing production code.
- Implement the minimum to pass, refactor while green, run regression checks (backend tests, frontend unit
  tests, lint, Prettier, build), then commit.
- Do not start the next slice until the checks pass.

After all slices: update `docs/estimates/agile.md` and the README roll-up to true percent complete (skill
`estimating-designs`); remove any scaffold note once the project is real; keep mocks, design system, screen
composition and designs aligned with what was built.

## Done means

- L2-031 to L2-038 work end to end, enforced on the server, with role and visibility rules proven by tests.
- `AGENTS.md` and the ADR record the two layout additions, and nothing else was added to the tree.
- All new and existing backend, frontend unit and Playwright tests pass; lint, format and build are clean.
- The documentation agrees with the code.
- The work is on a branch with a pull request to `main`, and its checks are green. Fetch and rebase first.
- Only then end the run, with a short summary of what was built, decisions made (with ADR links) and anything
  deferred.
