# Feature: Build the Resources subsystem

## Goal

Build, end to end, **Resources**: a searchable home inside FaithTech Community for the decks, logos, images,
training materials and templates that leads cannot find today because they are scattered across Drive,
SharePoint, Canva, Dropbox and email. Unlike earlier feature prompts, nothing exists yet for this subsystem: no
requirements, mocks, designs, estimate or code. This prompt carries the decisions already agreed (below); the
run produces the documentation first and then the implementation.

What users get:

- A **Resources** page (nav item "Resources") that opens on *Recently added*, newest first, filters by type and
  tag, and searches title, description, tags and file name. Every resource shows its owner, type, when it was
  added and, for files, the name, size and type.
- Leads (City, Event, Create, Communications), Staff and System Admin **add** resources: an uploaded file or an
  https link. Up to 20 files in one batch, each becoming its own resource. Everyone else finds, opens and
  downloads what is visible to them.
- Each resource has a title, optional description, a type (Deck, Logo, Image, Training, Template, Document,
  Other), free-text tags with autocomplete, and a visibility: **Private** (owner and System Admin), **Shared**
  (named members and/or roles) or **Global** (every signed-in member). New resources default to Global.
- Sharing notifies each recipient in-app and by email ("*Owner* shared *title* with you").
- A **Resources** group in global search, with visibility enforced inside the query.
- The owner edits, replaces the file in place and archives; archived resources can be restored for 30 days,
  then a background job purges the blob and the row. System Admin can override anything and transfer ownership,
  every override audited.
- Uploaded images get a thumbnail; every other kind shows a type icon.

Where it lives after this run:

- Backend: `Domain/Resources/`, `Application/Resources/`, blob storage and the purge worker in
  `Infrastructure/`, endpoints in `Api/Endpoints/ResourcesEndpoints.cs`, one EF migration applied by the Cli.
- Frontend: `frontend/projects/resources/` (new feature library), `RESOURCES_SERVICE` and `HttpResourcesService`
  in `api`, any new design-system components in `components`.
- Docs: `docs/specs/` (`L1-020 Resources (RES)`, L2 entries from `L2-055`), `docs/mocks/pages/resources`,
  `docs/mocks/pages/resource`, `docs/mocks/dialogs/add-resource`, `docs/mocks/dialogs/share-resource`,
  `docs/detailed-designs/resources/`, `docs/estimates/resources.md`, `docs/screen-composition.md`.
- E2E: `e2e/pages/resources*.ts`, `e2e/fixtures/mock-resources.ts`, `e2e/tests/resources/`.

Out of scope (do not build): usage counts, version history, text extraction or content search inside files,
page thumbnails for decks and PDFs, link reachability checks, collections or folders, any anonymous access.

## Agreed decisions (binding; record each in the requirements and an ADR, do not reopen)

| Decision | Agreed | Rejected |
|---|---|---|
| Storage | Both: uploads to Azure Blob behind the existing storage abstraction (ADR 0002, 0013) as the primary path, plus `https` links for things that must stay live elsewhere. | Upload only; links only. |
| Upload limits | 100 MB per file. Allowed: `pptx`, `ppt`, `key`, `pdf`, `docx`, `doc`, `xlsx`, `csv`, `png`, `jpg`, `svg`, `gif`, `webp`, `mp4`, `zip`. Others refused with an inline error naming the allowed types. | 25 MB; 500 MB any type. |
| Links | `https` only, open in a new tab, show an external icon and the host. No reachability check. | Weekly link checker; any URL. |
| Contributors | City, Event, Create and Communications Leads, Staff and System Admin. **Staff adding and owning resources is a deliberate carve-out** from the Staff read-only rule; write it into `AGENTS.md` and the domain rules in the same change as the requirements. | Leads and System Admin only; any member. |
| Visibility | Private, Shared (specific members and/or roles; recipients cannot re-share), Global (signed-in members). Default **Global**, picker always visible on the add dialog. Nothing anonymous. | Private or Global only; a city tier (data is global, no city boundary). |
| Organisation | Fixed type (Deck, Logo, Image, Training, Template, Document, Other) plus free tags, lower-cased and trimmed, with autocomplete from tags in use. | Collections or folders; curated tag list; search only. |
| Editing | Owner only; audited System Admin override. Replacing a file swaps it in place, no versions. | Any City Lead edits Global items; any contributor. |
| Ownership | Resources stay when the owner is suspended or loses a role; System Admin can transfer ownership, audited. | Auto-archive private and shared on suspension. |
| Batch add | Up to 20 files per add; title from file name, type from extension, tags and visibility chosen once for the batch. Links one at a time. | One file per add. |
| Finding | Resources page with *Recently added*, type and tag filters, search over title, description, tags, file name. One new `ISearchSource` in global search with the permission filter in the base query (ADR 0016). | Content extraction from PDF, PPTX, DOCX. |
| Previews | Image thumbnails via the SkiaSharp processor (ADR 0001); type icons for everything else. | Rendered first pages of decks and PDFs. |
| Notifications | `ResourceShared` kind through `INotificationPublisher`, in-app and email, in the same save as the share. No notification and no Home card for new Global resources. | Notify everyone on Global add. |
| Deleting | Archive with restore by the owner; purge blob and row 30 days after archiving (background job). | Hard delete. |
| Usage | No open or download counts. | Owner-visible download count. |

Two details are yours to settle during the requirements and design steps, then record in an ADR:

1. The exact wording of the Staff carve-out in `AGENTS.md` and the domain rules.
2. Whether a resource shared with a role follows later role changes live, or snapshots the recipients at share
   time as announcements do.

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: requirements, mocks, design system, screen composition,
  detailed design, estimate, then incremental ATDD implementation of every slice, verification, and a pull
  request.
- Do not pause between phases or slices for approval or wait for "continue". A plan, scaffold, partial
  implementation or list of next steps is not done.
- Keep a progress checklist across context summaries. Fix failed commands at their root cause; never weaken
  tests or silently skip checks.
- Only stop for a genuine external blocker (missing credentials, a required repository-layout approval beyond
  the new `resources` feature folders already implied by `AGENTS.md`). Finish all independent work and report the
  blocker precisely.

## Rules (read first, binding)

- Read `AGENTS.md` and every ADR in `docs/adr/`. Preserve the mandated layout and dependency directions. The
  feature is named `resources` everywhere the layout requires one name. Do not add v2 hackathon teams, projects
  or judging.
- Business logic lives in Application handlers and Domain; endpoints only dispatch. Every list, search, open and
  download enforces visibility on the server: Private returns 404 to anyone but the owner and System Admin;
  Shared returns 404 outside its audience; writes by non-owners return 403; Staff writes outside their own
  resources return 403. Audit every System Admin override and ownership transfer.
- Use components from `frontend/projects/components/` and contracts with injection tokens from
  `frontend/projects/api/`. Extend shared components before composing screens; the upload dropzone, tag picker,
  type icon and audience picker belong in `components` if the design system does not have them. Use CDK
  Dialog/Overlay, role tokens, labelled controls, visible focus and WCAG 2.2 AA. Feature libraries never depend on
  each other.
- Requirements, detailed design and mocks must exist and agree before production behavior changes.
- Backend tests under `backend/tests/` on unique EF in-memory databases; fake blob storage, email, time and the
  purge clock. No Docker, PostgreSQL, Testcontainers or other external services. Migrations in
  `Infrastructure/Persistence/Migrations`, applied through the Cli, never at API startup.
- Playwright: Chromium only, page objects under `e2e/pages/` own every selector, axe on each screen, the fake
  backend in `e2e/fixtures/` answers every request (uploads included) and an unrouted request fails the test.
  No architecture, naming, structure, banned-API or specification-parsing tests.

## Phase 1: Documentation (requirements, mocks, design, estimate)

Produce these in order, each with the matching skill, before any code:

1. **Requirements** (`writing-requirements`): `L1-020 Resources (RES)` and L2 entries from `L2-055` with
   Given-When-Then acceptance criteria covering: list and filter, add file and batch, add link, edit and replace,
   visibility and sharing, notifications, search group, archive, restore and purge, ownership transfer, upload
   limits and refusals, and the Staff carve-out. Update the roles and Staff rules in `AGENTS.md` in the same
   change.
2. **Mocks** (`writing-html-mocks`): `pages/resources` (default, loading, empty, no-results, error, filtered,
   archived view), `pages/resource` (file, link, image with thumbnail, private, shared, archived, forbidden),
   `dialogs/add-resource` (single file, batch, link, invalid type, over limit, busy, error, success),
   `dialogs/share-resource` (default, members and roles chosen, busy, error), `dialogs/archive-resource` and
   `dialogs/transfer-ownership`; the `ResourceShared` bell and email notifications; light and dark, phone,
   tablet and desktop; update `docs/mocks/manifest.json`, `index.html` and the coverage matrix.
3. **Design system** (`extracting-design-systems`): add any new component the mocks introduce (file dropzone,
   tag picker, type icon, file row) with every state and tokens.
4. **Screen composition** (`writing-screen-composition`): map every new page and dialog to `components`.
5. **Detailed design** (`writing-design-documents`): `docs/detailed-designs/resources/` with one design per
   slice group (`list-and-find`, `add-and-edit`, `share`, `archive-and-transfer`), rendered C4, class and sequence
   diagrams, the storage contract decision (widen `IPhotoStorage` or add a sibling file storage behind the same
   blob client), the purge worker, and the two open details settled and recorded in a new ADR.
6. **Estimate** (`estimating-designs`): `docs/estimates/resources.md`, the README roll-up, `docs/journeys.md`.

## Phase 2: Incremental implementation (ATDD)

Invoke `implementing-incrementally` first. Plan thin vertical slices, each with backend and Playwright
acceptance tests. Agreed order:

1. Resources page: list newest first, filter by type and tag, open and download uploaded files; add (single and
   batch upload) and edit with Private or Global visibility; image thumbnails; upload limits and refusals.
2. Link resources.
3. Shared visibility with members and roles, and the `ResourceShared` notification (in-app and email in one
   save).
4. Resources group in global search.
5. Archive, restore and the 30-day purge job.
6. System Admin ownership transfer, with audit.
7. Playwright specs with page objects and axe for every screen and dialog; idempotent seed data in the Cli;
   the e2e fake for every endpoint including upload.

For each slice:
- Write the Given-When-Then criteria, then the acceptance test traced to its requirement.
- Run it and show it fails for the expected reason before writing production code.
- Implement the minimum to pass, refactor while green, run regression checks (backend tests, frontend unit
  tests, lint, Prettier, `build:libs`, build), then commit.
- Do not start the next slice until the checks pass.

After all slices: update `docs/estimates/resources.md` and the README roll-up to true percent complete; keep
mocks, design system, screen composition and designs aligned with what was built; re-record any journey whose
screens changed (the shell gains a nav item).

## Done means

- `L1-020` and every L2 entry work end to end, enforced on the server, with no anonymous access.
- Permission denials (Private, Shared, Staff writes, non-owner edits), upload refusals and System Admin auditing
  are proven with behavior tests.
- All new and existing backend, frontend unit and Playwright tests pass; lint, format and build are clean.
- The documentation agrees with the code: requirements, mocks, design system, screen composition, designs,
  ADRs, estimates and `AGENTS.md` (Staff carve-out).
- The work is on a branch with a pull request to `main`, and its checks are green. Fetch and rebase first.
- Only then end the run, with a short summary of what was built, decisions made (with ADR links) and anything
  deferred.
