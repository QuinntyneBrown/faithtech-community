---
name: extracting-design-systems
description: >-
  Extract a complete, Figma-grade design system from the HTML mocks in
  docs/mocks/ into docs/design-system/: design tokens (colour with light and
  dark themes, typography, spacing, layout grid with gutters and margins,
  radius, elevation, motion, z-order), foundation pages, one HTML page per
  component with anatomy, variants, sizes, every state, responsive
  behaviour, theming, WCAG 2.2 AA accessibility, content rules, do/don't,
  tokens and code, plus patterns, a DTCG tokens.json and verified contrast.
  Use whenever the user mentions a design system, style guide, component
  library, UI kit, pattern library, tokens, theming, dark mode, brand
  colours, type or spacing scale, accessibility or contrast audit, or asks
  to make the UI consistent, document the components, extract the styles,
  or build frontend components from mocks; and proactively after
  writing-html-mocks finishes or when docs/mocks exists without
  docs/design-system. Requires docs/mocks; if absent, run
  writing-html-mocks first.
---

# Extracting design systems

A design system is the product's visual and interaction language written
down once, so every screen built afterwards is consistent without anyone
re-deciding. This skill mines the finished mocks in `docs/mocks/` for the
decisions they already embody, normalises them into tokens, and documents
each component the way a professional Figma design-system kit does, but as
browsable HTML that engineers can lift CSS from directly.

```
docs/design-system/
  README.md                     GitHub summary: catalog tables, drift log, verification record
  index.html                    entry page linking every foundation, component and pattern
  tokens/
    tokens.css                  single source of truth: primitives, semantic tokens, themes
    tokens.json                 DTCG export generated from tokens.css
    contrast-pairs.json         every fg/bg pairing the components rely on; checked
  assets/
    components.css              the component CSS, token-driven, with data-state hooks
    ds.css                      documentation-site chrome (from this skill's assets/)
    ds.js                       theme toggle, live token values, live contrast ratios
  foundations/<topic>.html      color, typography, spacing, layout, elevation, shape, motion,
                                iconography, theming, responsive, accessibility, content
  components/<name>.html        one page per component, fixed section order
  patterns/<name>.html          forms, feedback, empty states, navigation, dialogs, tables,
                                notifications, content
```

Read the references as you reach the steps that need them:
- `references/tokens.md` — token tiers, naming, categories, theming, the harvest→normalise method.
- `references/component-catalog.md` — every component to extract with its variants, states and ARIA pattern.
- `references/page-templates.md` — the page shell, component/pattern/foundation section skeletons, index and README.
- `references/example-component.html` — a complete, finished Button page to imitate.
- `references/accessibility.md` — the WCAG 2.2 AA commitments each page documents.
- `references/responsive-and-layout.md` — breakpoints, grid, gutters, margins, padding scale, per-component responsive rules.

Resolve `references/`, `assets/` and `scripts/` relative to this installed skill's
folder; resolve `docs/` relative to the consuming project.

---

## Step 0 — Mocks gate (do this first, every time)

A design system is extracted from evidence, not invented. Check that
`docs/mocks/` exists and contains HTML mocks (`manifest.json` plus files under
`pages/`, `dialogs/` or `notifications/`). If the mocks skill is installed,
run its checker first and fix or report what fails:

```sh
python "<writing-html-mocks-folder>/scripts/check_mocks.py" docs/mocks
```

**If `docs/mocks/` is missing or holds no HTML: stop and tell the user.** Say
that the system is extracted from mocks and that `writing-html-mocks` produces
them; do not scaffold a system from nothing. This is the one hard stop.

If `docs/design-system/` already exists, this is an update: keep token names
and page URLs stable, add what the new mocks introduce, and record every
changed value in the README's changelog section.

## Step 1 — Harvest the visual vocabulary

```sh
python "<installed-skill-folder>/scripts/harvest_styles.py" docs/mocks --classes > docs/design-system/.cache/harvest.md
```

Read the report. It lists every distinct colour, font, size, weight, line
height, spacing, radius, shadow, duration, z-index, breakpoint and custom
property with counts and files, each spacing value annotated with its
distance from the 4px grid, plus class-name frequencies (the component
inventory). Also read `docs/mocks/assets/tokens.css` and `ui.css` when they
exist; they are the mocks' own draft of the system. Keep `.cache/` out of git.

## Step 2 — Normalise into tokens

Follow `references/tokens.md`. Start from this skill's `assets/tokens.css` and
`assets/contrast-pairs.json` (the structure and names are the standard; the
values are a starter that already passes), then replace the values with the
harvested ones: brand hue, fonts, scale, radii, shadows, motion. Snap
off-grid spacing, collapse near-duplicate colours, keep at most 5 radii and 4
shadows, and log every deviation you corrected as drift. Build the dark theme
from roles. Then verify:

```sh
python "<installed-skill-folder>/scripts/check_contrast.py" docs/design-system/tokens/tokens.css
python "<installed-skill-folder>/scripts/tokens_to_json.py" docs/design-system/tokens/tokens.css
```

The contrast check must exit 0 for both themes. Extend
`contrast-pairs.json` with every pairing a component introduces (badge text
on badge background, selected row text, tooltip text, chart marks).

## Step 3 — Write the component CSS

`assets/components.css` is the product's stylesheet: every class the
components use, token-driven, with real pseudo-class states **and** the
matching `data-state="hover|focus|active"` hooks so the documentation can
show states statically. Start from `docs/mocks/assets/ui.css` when it exists
(it already follows the conventions), rename and tidy it into the catalog's
component list, and add component tokens (`--btn-bg`, `--field-border`, …)
that alias semantic tokens. No raw colour, size or duration is allowed in
this file; the checker rejects them.

## Step 4 — Write the foundation pages

One page per topic in `foundations/` (all twelve are required; the checker
fails on a missing one), following the shapes in
`references/page-templates.md`: color (ramps, roles, both themes, every
contrast pair with live ratios), typography (specimens, roles, measure),
spacing (the scale and inside/between rules), layout (breakpoints, columns,
gutters, margins, live grid, page templates), elevation (shadows, surfaces,
z-order), shape, motion (replayable demos, reduced motion), iconography,
theming (how themes work, adding one, `tokens.json`), responsive (per
`references/responsive-and-layout.md`), accessibility (per
`references/accessibility.md`) and content (voice, casing, numbers, error
and empty-state formulas, microcopy library). Every token in `tokens.css`
appears on exactly one foundation page with a `data-token` cell.

## Step 5 — Write one page per component

Work through `references/component-catalog.md`: every component that appears
in the mocks plus the starred core set. Each page follows
`references/example-component.html` exactly, with the thirteen sections in
order (`overview`, `anatomy`, `variants`, `sizes`, `states`, `responsive`,
`theming`, `accessibility`, `content`, `do-dont`, `tokens`, `code`,
`sources`), a section that does not apply marked `data-na="reason"`, and:

- the full state matrix (default, hover, focus, active, disabled, plus loading / selected / invalid / open where they exist) for every variant, using the real attribute where one exists and `data-state` otherwise;
- both themes side by side;
- the keyboard map, focus behaviour, labelling, live contrast pairs, motion and touch under `#accessibility`, naming the WAI-ARIA pattern used;
- the responsive rules the component follows at each breakpoint;
- the token table with live light and dark values;
- at least two do/don't pairs drawn from real mistakes in the mocks;
- links to the mocks it came from and the drift fixed.

The shared nav lists every page; regenerate it and paste it into all pages
when a page is added.

## Step 6 — Write the pattern pages

One page per pattern in the catalog (forms, feedback and loading, empty and
error states, navigation and page structure, dialogs and overlays, data
tables and lists, notifications, content and tone), each with the sections
`overview`, `when`, `structure`, `states`, `responsive`, `accessibility`,
`content`, `do-dont`, `sources` and a live composed example.

## Step 7 — Index and README

`index.html` links every foundation, component and pattern page and explains
how to use the system; `README.md` carries the catalog tables, the token
files, the drift log (mock, issue, resolution) and the verification record.
See `references/page-templates.md`.

## Step 8 — Verify before finishing

```sh
python "<installed-skill-folder>/scripts/check_design_system.py" docs/design-system
python "<installed-skill-folder>/scripts/check_contrast.py" docs/design-system/tokens/tokens.css
```

The structure check fails on: missing required files or foundation pages, a
component or pattern page missing a section, raw colour literals anywhere
outside `tokens/`, missing doctype/lang/title/viewport/`<main>`/single
`<h1>`, unlabelled controls, unnamed buttons or links, images without `alt`,
broken links or fragments, and any page not linked from `index.html` and
`README.md`. Fix every error. Then look at the pages: screenshot
`index.html`, three component pages and the color page at 360 and 1280 px in
both themes (the mocks skill's `screenshot_mocks.py docs/design-system --out
docs/design-system/.cache/shots` works for this; otherwise open them in a
browser) and fix overflow, clipped specimens, invisible focus rings and
dark-theme surfaces that do not read as raised.

Finally, close the loop with the mocks: point `docs/mocks` at
`../design-system/tokens/tokens.css` and `assets/components.css`, re-run the
mocks checker and screenshots, and record remaining differences as drift. Do
not claim the system is complete until both checkers exit 0 and the
screenshots have been reviewed.

## Quality bar

A finished system lets a designer open `index.html` and find every decision
a Figma kit would hold (tokens, type, colour with contrast, grid, elevation,
motion, every component with anatomy, variants, sizes, states, responsive
and accessibility notes, do/don't), and lets an engineer copy the class names
and `tokens.json` straight into the product. Every value traces to a mock or
to a logged correction; both themes pass WCAG 2.2 AA; nothing is a
placeholder.
