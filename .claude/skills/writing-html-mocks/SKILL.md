---
name: writing-html-mocks
description: >-
  Write static HTML mocks in docs/mocks/ for EVERY page, dialog and
  notification of a product in EVERY state (default, loading, empty, error,
  invalid, busy, success, no-results, forbidden, stacked...), responsive,
  light and dark, keyboard-accessible, with real copy and a coverage matrix.
  Use this skill BEFORE writing any frontend code, component, template, view
  or page; whenever the user says mock, mockup, wireframe, prototype, UI, UX,
  screen, layout, dialog, modal, toast, banner, empty/error/loading state,
  "what should this look like", "show me the UI", or describes a feature
  with a visible result; and whenever docs/specs or docs/detailed-designs
  exist but docs/mocks does not. Also use it to add missing states to
  existing mocks. Mocks come before implementation: if asked for frontend
  code with no mocks, say so and offer this first. Pair with
  extracting-design-systems to turn finished mocks into docs/design-system/.
---

# Writing HTML mocks

A mock set is the product on disk before the product exists: one real HTML
file per screen per state, sharing one token file and one component kit, so a
reviewer can click through every state of every page, dialog and notification
in light and dark at phone, tablet and desktop widths, with a keyboard. The set
is complete when the coverage matrix has no gaps and the review checklist has
no unticked box. "A delight to use" is the bar, and it is measurable: see
`references/delight.md`.

```
docs/mocks/
  README.md                      cast & catalog, open questions, coverage matrix (generated section)
  index.html                     gallery of every screen with state links (generated)
  manifest.json                  the list of screens, states and requirement IDs
  assets/
    tokens.css                   design tokens; the only place colours, sizes and durations live
    ui.css                       component kit shared by every mock; extend, never fork
    mock.css                     mock bar + annotation notes (not product UI)
    mock.js                      theme toggle, ?theme= and ?chrome= handling
  pages/<id>/<state>.html        one file per page state
  dialogs/<id>/<state>.html      one file per dialog state, shown over its page
  notifications/<id>/<state>.html one file per notification state, shown on its page
```

Read the references as you reach the steps that need them:
- `references/screen-inventory.md` — how to enumerate every screen and the state matrix per kind.
- `references/manifest.md` — the manifest format the checker and gallery use.
- `references/html-conventions.md` — file skeleton, semantics, state hooks, responsiveness, theming.
- `references/delight.md` — the UX principles and the per-mock review checklist.

Resolve `references/`, `assets/` and `scripts/` relative to this installed skill's
folder. Resolve `docs/` paths relative to the consuming project.

---

## Step 0 — Gather inputs (never a hard stop)

Read, in this order, whatever exists: `docs/specs/L1.md` and `L2.md` (keep the
requirement IDs verbatim), `docs/detailed-designs/**/README.md`, the router or
navigation code, existing templates and components, `docs/design-system/` and
any existing `docs/mocks/`. Then read the user's request.

Specs are not required; when they are missing, derive the screen list from the
request and the code and write the assumptions into `docs/mocks/README.md`
under *Open questions*. Ask the user only when two readings of the request
produce materially different page sets.

If `docs/design-system/` already exists, the mocks consume it: link its
`tokens/tokens.css` and `assets/components.css` instead of creating local
copies, and add any missing component to the system rather than to a mock.

## Step 1 — Inventory every screen and every state

Follow `references/screen-inventory.md`. Produce `docs/mocks/manifest.json`
listing every page, dialog and notification with its states, route,
`opens_from` and requirement IDs. Add the screens every product has (sign in,
reset password, 404, 403, 500, offline, settings, notification center…) even
when nobody mentioned them. Mark a required state `not_applicable` only with a
reason. Count the files before writing; a mid-sized product is 120–250 mocks.
That number is the task.

## Step 2 — Establish the shared assets

Copy `assets/tokens.css`, `assets/ui.css`, `assets/mock.css` and `assets/mock.js`
from this skill into `docs/mocks/assets/` (skip the ones a design system already
provides). Then adapt the tokens to the product before writing any mock:

- Brand: set the accent primitives (`--palette-blue-*` → the brand hue) and
  the font families. Keep the semantic token names.
- Density and shape: adjust `--radius-*`, `--control-height-*` if the product is
  compact or playful.
- Verify every change with the design-system skill's contrast checker if it is
  installed (`scripts/check_contrast.py tokens.css --pairs contrast-pairs.json`);
  otherwise keep the shipped values, which pass WCAG AA in both themes.

Define the cast and catalog (people, items, organisations, "today") at the top
of `docs/mocks/README.md` and reuse it in every mock.

## Step 3 — Write the mocks

Start from the matching template in `assets/templates/` (`page.html`,
`dialog.html`, `notification.html`) and follow `references/html-conventions.md`.
Write the `default` state of a screen first, then derive its other states from
it so the layout is identical and only the content differs. For each file:

- Real semantic HTML, real copy, the shared classes; a new component goes into
  `ui.css` with the same naming and state hooks, then gets used.
- Every interactive element reachable by keyboard, labelled, with a visible
  focus ring; dialogs trap focus and make the page behind `inert`; toasts sit in
  a live region.
- Mobile first and responsive at 360/768/1280 with no horizontal page scroll;
  bottom sheets under 640 px; collapsed navigation under 1024 px.
- No colours, sizes or durations outside tokens; both themes look intentional.
- The `mock:*` metas, the mock bar with sibling states, and a `.mock-note`
  wherever the static page cannot show an intent (timers, animations, focus
  order).
- Loading states use layout-matching skeletons; empty states explain and offer
  one action; error states keep the chrome and offer a way forward; invalid
  forms show inline errors plus a summary; success states say what happens next.

Work screen by screen, committing to the manifest as you go; do not leave a
screen half-covered to start another.

## Step 4 — Generate the gallery and check coverage

```sh
python "<installed-skill-folder>/scripts/check_mocks.py" docs/mocks --write
```

`--write` regenerates `index.html` and the coverage section of `README.md`
from the manifest, then re-checks. The check fails on: a required state with
no file and no reason, a file not in the manifest, mismatched `mock:*` metas,
missing doctype/lang/title/viewport/`<main>`/single `<h1>`, unlabelled form
controls, unnamed buttons or links, images without `alt`, placeholder text,
broken links or fragments, and a mock that does not link `tokens.css`. Fix
every error; a warning (no skip link, no mock bar) is a defect too unless you
can say why not.

## Step 5 — Look at every mock

Render the set and inspect it; a mock nobody has looked at is not finished:

```sh
python "<installed-skill-folder>/scripts/screenshot_mocks.py" docs/mocks
```

This writes PNGs for every mock at 360×800, 768×1024 and 1280×800 in light and
dark to `docs/mocks/.cache/mocks/` with a contact sheet, using the Python
`playwright` package or the Playwright CLI with Chromium (never commit
`.cache/`). Open the contact sheet (or read the PNGs) and fix clipped text,
overflow, wrong wrapping, invisible focus, low-contrast dark-theme surfaces
and layout shift between `loading` and `default`. If no browser is available,
say so, review the HTML by reading it, and list the screenshot command for the
user.

Then walk the review checklist in `references/delight.md` for each screen. Tab
through at least one page, one dialog and one toast in a browser when you can.

## Step 6 — Hand over

`docs/mocks/README.md` carries: the cast and catalog, how to open the mocks
(`index.html` from disk; `?theme=dark`, `?chrome=0`), the generated coverage
matrix with requirement IDs, open questions and assumptions, and the commands
to re-check and re-screenshot. Commit the HTML, assets, manifest, README and
gallery; never `.cache/`.

Finish by stating the counts (screens, states, files), what was assumed, and
that the next step is `extracting-design-systems` to turn the mocks into
`docs/design-system/`.

## Quality bar

A finished mock set lets a stakeholder open `docs/mocks/index.html` from disk
and click through the entire product: every page, every dialog over its page,
every notification on its page, every state, in both themes, at any width,
with a keyboard, with copy that reads like the shipped product, and nothing
that says "coming soon". Every file traces to the requirement it serves, and
the whole set shares one set of tokens and one component kit so the design
system can be extracted from it without guesswork.
