# Design tokens

Tokens are the contract between design and code: every colour, size, weight,
radius, shadow, duration and layer in the product is a named decision with a
value per theme. The system has exactly one source of truth,
`docs/design-system/tokens/tokens.css`, and everything else (component CSS,
documentation pages, the JSON export, the mocks) reads from it.

## Three tiers

| Tier | Prefix | Example | Who uses it |
|---|---|---|---|
| Primitive | `--palette-*`, `--font-*`, `--size-*` | `--palette-blue-600: #2563eb` | Only semantic tokens. Never a component, never a page. |
| Semantic | `--color-*`, `--text-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--ease-*`, `--z-*`, `--layout-*`, `--target-*`, `--control-height-*` | `--color-accent: var(--palette-blue-600)` | Components and pages. Themes override this tier only. |
| Component | `--button-*`, `--field-*`, `--dialog-*` … | `--button-bg: var(--color-accent)` | One component; declared in `components.css`; always aliases a semantic token. |

Rule of thumb: a value appears **once** as a primitive, gets **meaning** as a
semantic token, and gets **scoped** as a component token. Changing a brand hue
touches primitives only; changing what "accent" means touches semantic only;
changing how buttons look touches component tokens only.

## Naming

`--<category>-<role>[-<variant>][-<state>]`, kebab-case, singular nouns:

- `--color-bg-surface-raised`, `--color-fg-on-accent`, `--color-border-strong`
- `--color-<status>-{bg,fg,border,icon,solid}` for `info|success|warning|danger`
- `--color-accent{,-hover,-active,-subtle,-subtle-hover}`
- `--space-{0,0-5,1,2,3,4,5,6,8,10,12,16,20,24}` on a 4px base (number = multiples of 4)
- `--font-size-{xs,sm,md,lg,xl,2xl,3xl,4xl,5xl}`, `--text-{display,h1,h2,h3,h4,body-lg,body,body-sm,caption,label,overline,code}` as `font` shorthands
- `--radius-{xs,sm,md,lg,xl,full}`, `--shadow-{1,2,3,4,focus}`, `--duration-{instant,fast,base,slow,deliberate}`, `--ease-{standard,enter,exit,spring}`
- `--z-{base,raised,sticky,dropdown,overlay,modal,popover,toast,tooltip}`
- `--layout-{breakpoint-*,columns,gutter,margin,container-max,measure,sidebar-width,topbar-height}`

Never encode a value in a name (`--blue-text`, `--space-16px`), and never name
a semantic token after where it is used once (`--color-login-button`); that is
a component token.

## Categories and what each must cover

| Category | Must define | Notes |
|---|---|---|
| Colour | canvas, surface, surface-raised, surface-sunken, subtle, subtle-hover, inverse, backdrop; fg default/muted/subtle/disabled/inverse/link/link-hover/accent/on-accent/on-danger; border default/strong/inverse; accent + hover/active/subtle/subtle-hover; focus ring; four statuses × bg/fg/border/icon/solid | Every fg/bg pairing a component uses is listed in `contrast-pairs.json` and passes. |
| Typography | families (sans, mono), 9 sizes, 4 weights, 4 line heights, 3 letter spacings, 12 role shorthands | Body stays 16px; nothing below 12px; headings tighter line height. |
| Spacing | 4px scale from 0 to 96px | Components use ≤ `--space-6` inside; layout uses ≥ `--space-6` between. |
| Layout | 5 breakpoints, columns/gutter/margin per breakpoint, container max, measure, sidebar and topbar sizes | Columns 4/8/12, gutters 16/24/32, margins 16/32/48 by default. |
| Shape | 5 radii + full; 2 border widths | Radius grows with element size: inputs md, cards lg, sheets xl. |
| Elevation | 4 shadow levels + focus | Dark theme uses stronger, darker shadows and raised surfaces. |
| Motion | 5 durations, 4 easings | Reduced motion zeroes durations in the tokens, so components need no extra media queries. |
| Z-order | 9 layers | A component never sets a raw z-index. |
| Interaction | min and comfortable target sizes, focus ring width/offset, 3 control heights | 24px minimum (WCAG 2.5.8), 44px comfortable. |

## Theming

- Light is `:root`. Dark is `[data-theme="dark"]` **and** the same block inside
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`
  so the OS preference applies unless the page forces light. Keep the two
  blocks identical (copy one into the other); the contrast checker reads both.
- Set `color-scheme: light|dark` in each theme so native controls and
  scrollbars follow.
- Brand themes (a second product, a customer theme) are additional
  `[data-theme="<name>"]` blocks that override semantic tokens only.
- `prefers-contrast: more` raises borders and muted text to stronger tokens;
  `forced-colors: active` hands focus ring and borders to system colours.
- Dark is not inverted light: surfaces get lighter as they rise (canvas <
  surface < raised), accents get lighter and desaturated, text on accent flips
  to dark, status backgrounds are deep tints with light text.

## From mocks to tokens (the extraction method)

1. Run `scripts/harvest_styles.py docs/mocks` and read the report: distinct
   colours, sizes, spacing, radii, shadows, durations with counts and files.
2. For each category, cluster the values. Values that appear once and sit
   off-scale are mistakes to normalise, not tokens to add; note them in the
   README drift list.
3. Snap spacing and sizes to the 4px scale; snap type sizes to the modular
   scale; keep at most 5 radii and 4 shadows.
4. Map each surviving value to a primitive, then write the semantic tokens that
   explain where it is used. If two colours differ only slightly and serve the
   same role, keep one.
5. Build the dark theme from the roles, not from the light values.
6. Write `contrast-pairs.json` listing every fg/bg combination the components
   rely on, run `scripts/check_contrast.py`, and adjust primitives until every
   pair passes with margin (aim for ≥ 4.8:1 on body text, ≥ 3.3:1 on edges).
7. Export `tokens.json` with `scripts/tokens_to_json.py` so engineering can
   generate platform constants (DTCG format: `$type`, `$value`, aliases as
   `{group.token}`, theme overrides under `$extensions`).
8. Point the mocks at the system tokens and re-screenshot them. Differences are
   either drift to fix in the mocks or a token the system still lacks.

## Documenting tokens

`foundations/*.html` pages show every token with its name, value per theme,
usage, and a live sample. Token tables use `<td data-token="--space-4">` so
`ds.js` fills the resolved value for the current theme, and colour pairs use
`<span class="ds-pair__ratio" data-contrast="--color-fg-default|--color-bg-surface" data-min="4.5">`
to show the live ratio. Every token in `tokens.css` appears on exactly one
foundation page.
