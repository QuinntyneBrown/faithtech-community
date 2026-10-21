# Page templates

All documentation pages share one shell: sidebar navigation, a header with
kicker/title/lead, numbered sections with stable ids, and a footer. The shell
classes come from `assets/ds.css`; behaviour from `assets/ds.js`; product
components render through `assets/components.css`; everything resolves to
`tokens/tokens.css`. Copy the skeletons below exactly, then fill them.

Paths are relative to the page's folder: foundation, component and pattern
pages are one level deep, so they link `../tokens/tokens.css`,
`../assets/ds.css`, `../assets/components.css`, `../assets/ds.js` and
`../index.html`; the index links `tokens/tokens.css` and friends directly.

## Shared head and shell

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Button — Shelf design system</title>
<meta name="description" content="Buttons trigger actions. Five variants, three sizes, every state.">
<link rel="stylesheet" href="../tokens/tokens.css">
<link rel="stylesheet" href="../assets/components.css">
<link rel="stylesheet" href="../assets/ds.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="ds-shell">
  <nav class="ds-nav" aria-label="Design system">
    <div class="ds-nav__brand"><a href="../index.html">Shelf DS</a><button class="ds-theme-toggle" type="button" aria-pressed="false">☾ Dark</button></div>
    <details open><summary>Foundations</summary><ul>
      <li><a href="../foundations/color.html">Color</a></li>
      <!-- one <li> per foundation page, same list on every page -->
    </ul></details>
    <details open><summary>Components</summary><ul>
      <li><a href="../components/button.html">Button</a></li>
      <!-- one <li> per component page; always ../<folder>/<page>.html so the same nav works from every folder -->
    </ul></details>
    <details open><summary>Patterns</summary><ul>
      <!-- one <li> per pattern page -->
    </ul></details>
  </nav>
  <main id="main" class="ds-main">
    <header class="ds-header">
      <p class="ds-kicker">Component · Actions</p>
      <h1>Button</h1>
      <p class="ds-lead">One sentence on what it is for.</p>
      <div class="ds-meta"><span class="ds-pill ds-pill--ok">WCAG 2.2 AA</span><span class="ds-pill">Status: stable</span><span class="ds-pill">Since v1.0</span></div>
      <ul class="ds-toc"><li><a href="#overview">Overview</a></li><!-- one per section --></ul>
    </header>
    <!-- sections -->
    <footer class="ds-footer"><span>Shelf design system · extracted from <a href="../../mocks/index.html">docs/mocks</a></span><a href="#top">Back to top</a></footer>
  </main>
</div>
<script src="../assets/ds.js"></script>
</body>
</html>
```

`ds.js` marks the current page in the nav. Keep the nav list identical on
every page (generate it once and paste it) so a reader can move anywhere from
anywhere. Because every page sits one folder deep, nav links always take the
`../<folder>/<page>.html` form; the index uses `<folder>/<page>.html`.

## Component page sections

```html
<section class="ds-section" id="overview"><h2><a href="#overview">Overview</a></h2>
  <p>What it is, when to use it, when not to (and what to use instead).</p>
</section>

<section class="ds-section" id="anatomy"><h2><a href="#anatomy">Anatomy</a></h2>
  <div class="ds-anatomy">
    <figure class="ds-anatomy__figure">
      <button class="btn btn--primary" type="button"><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New loan</button>
      <span class="ds-callout" style="left: 32%; top: 28%;" aria-hidden="true">1</span>
      <span class="ds-callout" style="left: 54%; top: 28%;" aria-hidden="true">2</span>
      <span class="ds-callout" style="left: 70%; top: 70%;" aria-hidden="true">3</span>
    </figure>
    <ol class="ds-anatomy__list">
      <li><div><b>Leading icon (optional)</b><small>20px, inherits colour</small></div></li>
      <li><div><b>Label</b><small>Verb phrase, sentence case</small></div></li>
      <li><div><b>Container</b><small>40px tall, 8px radius, 16px padding</small></div></li>
    </ol>
  </div>
</section>

<section class="ds-section" id="variants"><h2><a href="#variants">Variants</a></h2>
  <p>Why each variant exists and the rule for choosing one.</p>
  <div class="ds-example"><div class="ds-example__canvas">…one of each variant…</div>
    <div class="ds-example__caption"><span>Primary, secondary, ghost, link, danger</span></div>
    <details class="ds-example__code"><summary>HTML</summary><pre><code>&lt;button class="btn btn--primary"&gt;…</code></pre></details>
  </div>
</section>

<section class="ds-section" id="sizes"><h2><a href="#sizes">Sizes</a></h2>…</section>

<section class="ds-section" id="states"><h2><a href="#states">States</a></h2>
  <div class="ds-matrix"><table>
    <thead><tr><th scope="col">Variant</th><th scope="col">Default</th><th scope="col">Hover</th><th scope="col">Focus</th><th scope="col">Active</th><th scope="col">Disabled</th><th scope="col">Loading</th></tr></thead>
    <tbody>
      <tr><th scope="row">Primary</th><td><button class="btn btn--primary" type="button">Save</button></td><td><button class="btn btn--primary" type="button" data-state="hover">Save</button></td>…</tr>
    </tbody>
  </table></div>
  <div class="ds-themes"><div data-theme="light">…</div><div data-theme="dark">…</div></div>
</section>

<section class="ds-section" id="responsive"><h2><a href="#responsive">Responsive behaviour</a></h2>…</section>
<section class="ds-section" id="theming"><h2><a href="#theming">Theming</a></h2>
  <p>Which semantic tokens the component reads, how it looks in each theme, how to re-theme it (override component tokens).</p>
</section>
<section class="ds-section" id="accessibility"><h2><a href="#accessibility">Accessibility</a></h2>
  <h3>Role and pattern</h3><p>…</p>
  <h3>Keyboard</h3><table class="ds-table ds-keys"><thead><tr><th>Key</th><th>Action</th></tr></thead><tbody>…</tbody></table>
  <h3>Focus</h3><p>…</p>
  <h3>Labelling</h3><p>…</p>
  <h3>Contrast</h3><div class="ds-pair"><span>Label on primary</span><span class="ds-pair__ratio" data-contrast="--color-fg-on-accent|--color-accent" data-min="4.5"></span></div>
  <h3>Motion</h3><p>…</p>
  <h3>Touch</h3><p>…</p>
</section>
<section class="ds-section" id="content"><h2><a href="#content">Content</a></h2>…label rules, examples…</section>
<section class="ds-section" id="do-dont"><h2><a href="#do-dont">Do and don't</a></h2>
  <div class="ds-dodont">
    <figure class="ds-do"><div class="ds-example__canvas">…</div><figcaption>Use one primary button per view.</figcaption></figure>
    <figure class="ds-dont"><div class="ds-example__canvas">…</div><figcaption>Use two primary buttons side by side.</figcaption></figure>
  </div>
</section>
<section class="ds-section" id="tokens"><h2><a href="#tokens">Tokens</a></h2>
  <div class="ds-table-wrap"><table class="ds-table">
    <thead><tr><th>Part</th><th>Token</th><th>Light</th><th>Dark</th></tr></thead>
    <tbody><tr><td>Background (primary)</td><td><code>--color-accent</code></td><td><span class="ds-swatch-cell" data-theme="light"><i data-token="--color-accent" data-swatch></i><span data-token="--color-accent"></span></span></td><td><span class="ds-swatch-cell" data-theme="dark"><i data-token="--color-accent" data-swatch></i><span data-token="--color-accent"></span></span></td></tr></tbody>
  </table></div>
</section>
<section class="ds-section" id="code"><h2><a href="#code">Code</a></h2>
  <pre><code>&lt;button class="btn btn--primary" type="button"&gt;Save&lt;/button&gt;</code></pre>
  <table class="ds-table"><thead><tr><th>Class / attribute</th><th>Effect</th></tr></thead><tbody>…</tbody></table>
</section>
<section class="ds-section" id="sources"><h2><a href="#sources">Sources</a></h2>
  <p>Mocks this component was extracted from:</p>
  <ul><li><a href="../../mocks/pages/loans/default.html">pages/loans/default</a></li></ul>
  <p>Drift fixed during extraction: …</p>
</section>
```

Theme wrappers: `ds.js` resolves `data-token` and `data-contrast` inside the
nearest `[data-theme]` ancestor, so a `<span data-theme="dark">` around a
token cell shows the dark value even while the page is light.

## Pattern page sections

`overview`, `when` (when to use which composition), `structure` (the
composition with a live example), `states`, `responsive`, `accessibility`,
`content`, `do-dont`, `sources`.

## Foundation page shape

Foundation pages are free-form but each has, in order: an `#overview`, one
section per token group with a live specimen and a token table, a
`#usage` section with rules, an `#accessibility` section where relevant
(colour: contrast pairs; typography: sizes and spacing; motion: reduced
motion), and `#tokens` listing every token of the category with
`data-token` cells. Required pages and what each covers:

| Page | Covers |
|---|---|
| `color.html` | Primitive ramps (`.ds-ramp`), semantic roles (`.ds-swatches`), status colours, both themes side by side, every contrast pair with live ratios, how to add a brand theme. |
| `typography.html` | Families, scale specimens (`.ds-specimen`), weights, line heights, role shorthands, measure, responsive type rules. |
| `spacing.html` | The 4px scale (`.ds-scale`), inside vs between rules, padding by component size. |
| `layout.html` | Breakpoints, columns/gutters/margins table and live grid demo (`.ds-grid-demo`), container, sidebar/topbar sizes, page templates (shell, auth, settings, detail). |
| `elevation.html` | Shadow levels (`.ds-shadow-grid`), surface hierarchy, z-order table, how dark theme handles elevation. |
| `shape.html` | Radii scale (`.ds-scale__box`), border widths, which radius for which size. |
| `motion.html` | Durations and easings with replayable demos (`.ds-motion-demo`), choreography rules, reduced motion. |
| `iconography.html` | Icon set and style (24-unit grid, 2px stroke, `currentColor`), sizes, labelling rules, a sheet of the icons used in the mocks as inline SVG. |
| `theming.html` | How themes work (`data-theme`, `prefers-color-scheme`, `color-scheme`), the token tiers, adding a theme, do's and don'ts, `tokens.json` consumption. |
| `responsive.html` | Mobile-first rules, breakpoint behaviours per component, touch rules, testing matrix. |
| `accessibility.html` | The WCAG 2.2 AA checklist from `references/accessibility.md` as the system's commitments, testing procedure, component contract. |
| `content.html` | Voice and tone, sentence case, button verbs, numbers/dates/times, error message formula, empty-state formula, microcopy library (common labels). |

## `index.html`

Header with the product name, one-paragraph purpose, "Start here" cards
(`.ds-cards`) for Color, Typography, Layout, Button, Form field and Dialog,
then three card grids listing **every** foundation, component and pattern
page (the checker fails on any page missing from the index), a "How to use"
section (link the CSS, use the classes, consume `tokens.json`), and a
"Provenance" section linking `../mocks/index.html` and the extraction date.

## `README.md`

Renders on GitHub:

```markdown
# <Product> design system

Extracted from [docs/mocks](../mocks/README.md) on <date>. Open [index.html](index.html) locally.

## Foundations
| Page | Covers |
## Components
| Component | Variants | States | Source mocks |
## Patterns
| Pattern | Covers |
## Tokens
- `tokens/tokens.css` — source of truth; `tokens/tokens.json` — DTCG export; `tokens/contrast-pairs.json` — checked pairs.
## Drift found in the mocks
| Mock | Issue | Resolution |
## Verification
Commands run and their results (contrast, structure check, screenshots).
```
