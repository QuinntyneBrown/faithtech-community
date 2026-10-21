---
name: writing-screen-composition
description: Create or update docs/screen-composition.md, a document that itemizes every page, dialog, notification and shell part from the HTML mocks and lists, for each, the component-library components it shall be composed of plus the UI that must be built locally. Also ensures AGENTS.md has the "Components library is mandatory (CRITICAL)" section. Use when the user mentions screen composition, which components a page uses, mapping mocks to a component library, local vs library UI, or before implementing an application against a component library; and whenever docs/mocks and a component catalogue exist but docs/screen-composition.md does not or is out of date.
---

# Writing screen composition

Turn finished mocks into a binding map from each screen to the library components that build it, and make agents obey that map.

## Inputs

- `docs/mocks/` — one folder per screen under `pages/`, `dialogs/`, `notifications/`, each with one HTML file per state. `docs/mocks/index.html` lists them and the shell.
- A component catalogue: the component library's public API or an interface document (in this repo `docs/icd/components-library-application.md` §9 and `frontend/projects/components/src/public-api.ts`).

If the mocks or the catalogue are missing, say so and stop; mocks come first (`writing-html-mocks`).

## Steps

1. **Inventory the screens.** List every folder under `pages/`, `dialogs/` and `notifications/`, and every state file in each. Take route, title and requirement IDs from `docs/mocks/index.html`. Identify the shell: skip link, header, footer, toast region, compare bar or similar parts that wrap every page.
2. **Inventory the library.** List each public component by class name and selector, and each service (dialogs, toasts). Use only names that exist in the catalogue.
3. **Read the mocks.** For each screen, extract the CSS classes and structure of the default state and of the states that add UI (error, empty, loading, busy, success, over-limit...). Strip `<style>`/`<script>` and mock-only chrome (`mock-bar`, `mock-note`) first; a script is fine for this.
4. **Map each screen.** Match each block to a library component. Anything with no match is **local UI**. Do not invent library components. If something looks reusable, still list it as local and note it for catalogue change control.
5. **Write `docs/screen-composition.md`** with:
   - an intro: sources, what "local UI" means, that mock-only chrome is excluded;
   - **Shell** table: part, library components, local UI;
   - **Shared local components** table: item, used by, notes (build once, reuse);
   - **Pages** (public, then admin): for each, heading with route and mock folder + states, then `Library:` and `Local:` lines. Group identical pages (for example three admin lists) under one entry;
   - **Dialogs** table: dialog (mock folder: states), overlay surface, library components, local UI;
   - **Notifications** table in the same shape;
   - **Summary of local UI to build**: a numbered list.
   Name components by class name. Note states that change composition (for example error uses the alert component, empty uses the empty-state component).
6. **Verify coverage.** Compare the mock folders against the document headings and tables: every page, dialog and notification folder appears, every state appears, and every component named exists in the catalogue. Fix gaps. Report anything inferred rather than read from a mock.
7. **Ensure AGENTS.md has the mandate.** If `AGENTS.md` has no section titled `## Components library is mandatory (CRITICAL)`, add it just before the scope/simplicity section; if it exists, make sure it says the same things. Adjust names to the project:

   ```markdown
   ## Components library is mandatory (CRITICAL)

   - The `<app>` application MUST be built from `@<scope>/components`.
     Never hand-write markup, CSS, icons, overlays or toasts the library already
     provides. Use the library component, `DialogService` and `ToastService`.
   - `docs/screen-composition.md` is binding. Before implementing any page,
     dialog, notification or shell part, read its entry and use exactly the
     components it lists. Build locally only the UI it marks as local.
   - If the library lacks something the entry needs, STOP. Update the interface
     document and the library first. Do not work around it in the app.
   - Keep `docs/screen-composition.md` aligned with the mocks and the interface document.
   ```

   If `AGENTS.md` is marked as generated, tell the user the edit may be lost on regeneration and where the source should change.
8. **Report** the screens covered, the local UI summary, anything inferred, and whether `AGENTS.md` changed.

## Rules

- Documentation only: no tests, no code, no mock edits.
- Keep it brief and itemized; tables over prose.
- When mocks change, update this document in the same change.
- Do not add behaviour, screens or states that the mocks do not show.
