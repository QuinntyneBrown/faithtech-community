# HTML conventions for mocks

Mocks are real HTML: they open from the filesystem, respond to hover, focus and
keyboard, switch themes, and are later mined by the design-system skill. These
conventions make them consistent, reviewable and extractable.

## File skeleton

Every mock starts from one of the three templates in the skill's `assets/templates/`
(`page.html`, `dialog.html`, `notification.html`). Keep this order and content:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Loans · empty — Shelf mocks</title>
<meta name="mock:kind" content="page">            <!-- page | dialog | notification -->
<meta name="mock:screen" content="loans">         <!-- folder name -->
<meta name="mock:state" content="empty">          <!-- file name without .html -->
<meta name="mock:requirements" content="L2-LOAN-001 L2-LOAN-004">  <!-- verbatim spec IDs, space separated; omit when there are no specs -->
<meta name="description" content="One sentence a reviewer can read in the gallery.">
<link rel="stylesheet" href="../../assets/tokens.css">
<link rel="stylesheet" href="../../assets/ui.css">
<link rel="stylesheet" href="../../assets/mock.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
…page chrome (topbar, sidebar)…
<main id="main" class="container">…</main>
…overlays (backdrop, dialog, toast-region)…
<nav class="mock-bar" aria-label="Mock navigation">…sibling states, theme toggle…</nav>
<script src="../../assets/mock.js"></script>
</body>
</html>
```

The three `mock:*` metas must match the path (`pages/loans/empty.html`);
`check_mocks.py` fails otherwise. When the project already has
`docs/design-system/`, link its `tokens/tokens.css` and `assets/components.css`
instead of the local copies, so mocks consume the system.

## Shared assets

```
docs/mocks/assets/
  tokens.css   design tokens (colour, type, space, radius, shadow, motion, layout, z) — themes live here
  ui.css       the component kit; extend it, never fork per mock
  mock.css     the mock bar and annotation notes (not product UI)
  mock.js      theme/chrome switches; no framework
```

Change a token, and every mock changes. Change a class in `ui.css`, and every
mock changes. That is the point: a mock that needs a new component adds it to
`ui.css` with the same naming (`.block`, `.block__part`, `.block--variant`) and
the same state hooks, then uses it. Per-mock `<style>` blocks are allowed only
for one-off layout (a grid specific to one page) and must still use tokens;
raw colours, pixel sizes and durations outside tokens are not allowed anywhere.

## Semantics and accessibility

- Landmarks: one `<header>` (topbar), one `<nav aria-label="Primary">`, exactly one `<main id="main">`, `<footer>` when there is one. Dialogs and toasts sit outside `<main>`.
- One `<h1>` per mock (the page title; a dialog's title is an `<h2>`). Heading levels never skip.
- Buttons do things, links go places. `<button type="button">` for every non-submit button.
- Icon-only controls carry `aria-label`; decorative SVGs carry `aria-hidden="true"`; icons are inline SVG with `class="icon"` using `currentColor` (24-unit viewBox, 2px stroke).
- Every form control has a `<label>` (wrapping, or `for=`); help text and errors are connected with `aria-describedby`; invalid fields have `aria-invalid="true"`; required fields say so in the label, not with an asterisk alone.
- Tables have `<caption>` (visually hidden is fine), `<th scope="col|row">`, sortable headers use `aria-sort`.
- Tabs use `role="tablist"/"tab"/"tabpanel"` with `aria-selected` and `aria-controls`; the current nav link has `aria-current="page"`; the current step has `aria-current="step"`.
- Dialogs: `role="dialog" aria-modal="true" aria-labelledby aria-describedby`, the page behind gets `inert` (and `aria-hidden="true"` for older browsers), focus starts on the first field or the safe button (`autofocus`), there is a close button and Escape closes.
- Toasts live in `<div class="toast-region" role="status" aria-live="polite">`; error toasts use `role="alert"`. The region is in the DOM even when empty.
- Badge counts have an `aria-label` with the meaning ("2 overdue"), not just the number.
- Text sizes in `rem` via tokens; nothing below `--font-size-xs` (12px); body stays at 16px.
- Targets: at least `--target-min` (24px) on desktop controls; `--target-comfortable` (44px) for primary mobile actions and nav items.
- Colour is never the only cue: badges have a dot and a word; errors have an icon and text; links are underlined.

## Showing states statically

The UI kit styles both the real pseudo-class and an attribute, so a mock can
show a state without interaction:

```html
<button class="btn btn--primary" data-state="hover">Renew</button>
<input class="input" data-state="focus" …>
<button class="btn" aria-busy="true">Saving…</button>        <!-- loading -->
<button class="btn" disabled>Return</button>                 <!-- disabled: use the real attribute -->
<tr data-state="hover">…</tr>
```

Use the real attribute whenever one exists (`disabled`, `aria-busy`,
`aria-invalid`, `aria-selected`, `aria-pressed`, `aria-current`, `checked`,
`open`); use `data-state` only for pointer and focus states, which cannot be
expressed in static HTML.

## Responsiveness

- Mobile first: the base styles are for 360 px; `@media (min-width: 48rem)` and `(min-width: 64rem)` add columns, side navigation and wider gutters. Tokens already change `--layout-columns`, `--layout-gutter` and `--layout-margin` per breakpoint.
- No horizontal page scroll at any width. Tables scroll inside `.table-wrap`; long toolbars wrap with `.cluster`.
- Dialogs become bottom sheets under 640 px (`.dialog` handles it); drawers go full width.
- Sidebars collapse under 1024 px behind the topbar menu button; the mock shows the collapsed state in `pages/<id>/default.html` at 360 px without any extra file.
- Touch: hover-only affordances are always visible under `(hover: none)`.

## Theming

- Never write a colour; write a token (`var(--color-fg-muted)`). The checker in the design-system skill rejects raw colours; start clean here.
- Dark theme comes free from `tokens.css` via `[data-theme="dark"]` and `prefers-color-scheme`. The mock bar toggles it; `?theme=dark` forces it (screenshots use this).
- Shadows and elevation: `--shadow-1` cards, `--shadow-2` raised, `--shadow-3` menus/popovers, `--shadow-4` dialogs. In dark theme the tokens already swap to darker, larger shadows.
- Images and illustrations must work on both canvases (use SVG with `currentColor` or transparent PNG).

## Mock chrome and annotations

- The `.mock-bar` lists sibling states with `aria-current="page"` on the current one and links back to `../../index.html`. Keep it in sync with the manifest.
- `.mock-note` boxes explain design intent that the static page cannot show ("auto-dismisses after 8 s; pauses on hover"). Position them with inline `top/right/bottom/left` only; keep them short; they vanish with `?chrome=0`.
- `?chrome=0` must leave a page that looks exactly like the product.

## Data consistency

Create a small cast and catalog for the project and reuse it everywhere: the
same five people, the same ten items, the same organisation names, the same
dates relative to one "today". Reviewers follow a story across screens; a
different name on every page breaks it. Keep this cast in a comment block at
the top of `README.md` so later mocks reuse it.

## What not to do

- No frameworks, bundlers, CDNs or web fonts that need a network. Mocks open from disk.
- No JavaScript beyond `mock.js` unless a state cannot be shown otherwise; if you must, keep it inline, tiny, and progressive.
- No `<div>` buttons, no `tabindex` above 0, no `outline: none` without a replacement, no `title` as the only label.
- No placeholder copy, no "TODO" in a mock, no `<!-- fix later -->`. If something is unknown, mark the decision in a `.mock-note` and in the README's open questions.
