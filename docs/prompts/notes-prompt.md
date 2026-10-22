# Feature: Docs & notes (block-based pages)

## Goal

Build, end to end, **Docs & notes** (feature name `notes`): a place inside FaithTech Community where members write, format and link pages made of flexible blocks that they can drag into any order. Today leads keep meeting notes, playbooks and how-tos in Drive, SharePoint and email. Nothing exists yet for this subsystem: no requirements, mocks, designs, estimate or code. The closest neighbour to copy for structure and house style is **Resources** (`frontend/projects/resources/`, `docs/detailed-designs/resources/`, `docs/prompts/resources-prompt.md`, `docs/proposals/resources.md`).

What users get (suggestions the implementer may adjust within the scope lock):

- A **Notes** nav item and a page list: recently edited first, search by title, filter by owner. A page opens at its own route.
- A **page** has a title, an optional icon, and an ordered list of **blocks**. Block types: paragraph, heading 1-3, bulleted list, numbered list, to-do (checkable), quote, callout, code, divider, image (alt text required, same rule as profile photos) and link card.
- **Formatting** inside text blocks: bold, italic, underline, strike, inline code, hyperlink. Markdown shortcuts (`# `, `- `, `1. `, `[] `, `> `) and a `/` command menu to insert a block or turn it into another type.
- **Drag and drop**: reorder blocks by a handle, with a clear drop indicator. Use Angular CDK drag-drop. There MUST be a keyboard and screen-reader alternative (move up / move down from the block menu and a shortcut) so the feature meets WCAG 2.2 AA, including 2.5.7 Dragging Movements.
- **Linked pages**: type `[[` to link another page (autocomplete by title). Each page shows **backlinks**. Pages can be nested under a parent page (breadcrumb). A link to a page the viewer cannot see shows as "Private page" and never leaks the title.
- Autosave with a visible saving / saved / failed state. Optimistic concurrency: if the page changed elsewhere, the save is refused and the user is told. No silent overwrite.
- Visibility per page, same model as Resources: **Private** (owner and System Admin), **Shared** (named members and/or roles), **Global** (every signed-in member). Default Private. Archive and restore (soft delete).
- Pages appear as a **Notes** group in global search, with visibility enforced inside the query.

Unchanged: all existing features, roles and the data-is-global rule. Pages are never visible to anonymous visitors.

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: mocks, design system, requirements, detailed design, estimate, incremental ATDD implementation, green tests and a pull request. Go through every phase and every slice in one continuous run.
- Do not end your turn until the "Done means" list at the bottom is fully true.
- Where `AGENTS.md` says "stop and ask", treat this prompt as the confirmation in advance for everything in scope here, including the new `notes` folders in the repository layout (add them to `AGENTS.md` before placing code there). Record choices in an ADR (next free number after 0022) or the detailed design's open questions, and keep going.
- If `components` lacks something (block editor surface, drag handle, slash menu, callout, breadcrumb, toolbar), update the design system and `components` first, then go on.
- When a test, build or command fails, find the root cause and fix it. Never weaken a test.
- Only stop for a real blocker you cannot resolve yourself. Keep a todo list.

## Rules (binding)

- Follow `AGENTS.md` exactly: mandatory layout and one feature name `notes`; the components library is mandatory; pages never call `HttpClient`; API services have a contract and an injection token; no inline forms in pages (the block editing surface is a content editor, not a form: record that in an ADR); CDK Dialog for modals.
- Domain rules: enforce every permission on the server (queries, search, backlinks, link previews). Staff follow the Resources precedent (Staff may add pages and edit, share, archive and restore their own, nothing else). System Admin can override and every override is audited. City Leads follow the same rules as in Resources.
- Backend: business rules in Application handlers; one migration applied by the Cli; idempotent seed; endpoints authenticated by default; no secrets. Tests on the EF Core in-memory provider, unique database per fixture, authorisation tests alongside the feature.
- E2E: Playwright, Chromium only, Page Object Model, axe on every screen, no backend running; extend the fake in step with the API.
- Never write architecture tests.

## Phases

1. Mocks (`writing-html-mocks`): list, editor in every state, dialogs (share, page settings, move, archive/restore), forbidden and not-found; manifest, gallery, coverage matrix.
2. Design system (`extracting-design-systems`) and screen composition (`writing-screen-composition`).
3. Requirements (`writing-requirements`): L1 after L1-021, L2 from L2-085.
4. Detailed design (`writing-design-documents`): `docs/detailed-designs/notes/` per slice with rendered diagrams; ADRs for block storage, ordering, concurrency, editor approach, Staff rules.
5. Estimate (`estimating-designs`): `docs/estimates/notes.md`.
6. Incremental implementation (ATDD, `implementing-incrementally`): domain and list; editor and autosave; block types, `/` menu, shortcuts; formatting; drag and keyboard reorder; links, backlinks, nesting; visibility and sharing; conflicts; archive and restore; search; images; audit and accessibility pass. Each slice: criteria, failing acceptance test, minimum implementation, regression checks, commit.

## Deferred (do not build)

Real-time co-editing and presence, comments and person mentions, version history, page templates, import/export (Markdown, PDF), databases and tables, embeds from other services, public sharing, offline editing.

## Done means

- A member can create a page, add and format blocks of every listed type, reorder them by drag and by keyboard, link and nest pages, see backlinks, share or keep a page private, archive and restore it, and find it in global search. Permissions are enforced on the server and tested.
- All new and existing tests pass: backend, Angular unit, lint, Prettier, Playwright (Chromium, no backend running, axe clean).
- The documentation agrees with the code: `AGENTS.md` layout, mocks, design system, screen composition, L1/L2, detailed designs, ADRs and estimates.
- The work is on a branch with a pull request to `main`, and its checks are green.
