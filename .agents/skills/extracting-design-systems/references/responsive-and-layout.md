# Responsive design and layout

The system is mobile first: base styles target 360 px, and breakpoints add
space, columns and side navigation. Layout is driven by tokens so that
gutters, margins and column counts are the same decision everywhere.

## Breakpoints

| Token | Width | Typical device | Columns | Gutter | Margin |
|---|---|---|---|---|---|
| (base) | 0–639 px | phones | 4 | 16 px (`--space-4`) | 16 px (`--space-4`) |
| `--layout-breakpoint-sm` | 640 px | large phones, landscape | 4 | 16 px | 16 px |
| `--layout-breakpoint-md` | 768 px | tablets | 8 | 24 px (`--space-6`) | 32 px (`--space-8`) |
| `--layout-breakpoint-lg` | 1024 px | laptops | 12 | 32 px (`--space-8`) | 48 px (`--space-12`) |
| `--layout-breakpoint-xl` | 1280 px | desktops; container max | 12 | 32 px | 48 px |
| `--layout-breakpoint-2xl` | 1536 px | wide screens; content stays at container max | 12 | 32 px | auto |

`tokens.css` updates `--layout-columns`, `--layout-gutter` and `--layout-margin`
at `md` and `lg`; components read those tokens instead of writing their own
media queries wherever possible. Use `min-width` queries only; express them in
`rem` (`48rem`, `64rem`) so they scale with the user's font size. Custom
properties cannot be used inside `@media`, so the values are repeated there by
convention and documented on the layout page.

## Grid, gutters, margins

- **Margin** is the space from the viewport edge to content (`--layout-margin`).
- **Gutter** is the space between columns (`--layout-gutter`).
- **Container** caps content at `--layout-container-max` (1280 px) and centres it.
- **Measure** caps prose at `--layout-measure` (65ch).
- The grid is `repeat(var(--layout-columns), minmax(0, 1fr))` with `gap: var(--layout-gutter)`; cards use `auto-fill, minmax(18rem, 1fr)`.
- Vertical rhythm: sections `--space-8` to `--space-12` apart; inside a card `--space-4` to `--space-6`; between related controls `--space-2` to `--space-3`.

## Padding scale by component size

| Size | Height | Horizontal padding | Font |
|---|---|---|---|
| sm | 32 px (`--control-height-sm`) | 12 px (`--space-3`) | `--font-size-sm` |
| md | 40 px (`--control-height-md`) | 16 px (`--space-4`) | `--font-size-md` |
| lg | 48 px (`--control-height-lg`) | 24 px (`--space-6`) | `--font-size-lg` |

Cards: 24 px (`--space-6`); dialogs: 24 px with 16 px between header, body and footer; toasts: 16 px; menus: 4 px around, 12 px inside items; table cells: 12 × 16 px.

## Responsive behaviours each component documents

- **Navigation**: sidebar visible ≥ lg, otherwise a drawer behind a menu button; topbar links hidden < md; breadcrumbs collapse to the parent only < md.
- **Dialogs**: centred ≥ sm; full-width bottom sheet < sm with the footer sticky.
- **Drawers**: 28rem panel ≥ sm; full width < sm.
- **Tables**: horizontal scroll inside `.table-wrap` with the first column optionally sticky; or a card list < md when the table has ≤ 4 columns and the page says so.
- **Toasts**: bottom-right 24rem ≥ sm; full width bottom < sm.
- **Forms**: one column < md; two columns ≥ md only for short related fields (first/last name, city/postcode).
- **Tabs**: horizontal scroll with fade when they overflow; never wrap to two rows.
- **Page header**: actions move below the title < md; primary action stays full width on phones.
- **Stepper**: labels hidden except the current step < md.

## Fluid type and spacing

Type uses fixed steps from the scale, not viewport units, so that it respects
user zoom; display sizes may use `clamp(2.25rem, 1.5rem + 2vw, 3rem)` and are
documented as such. Spacing never scales with viewport width; the breakpoint
changes the token.

## Touch and pointer

- `(hover: none)` reveals hover-only affordances permanently.
- `(pointer: coarse)` is not used to grow targets; targets are already ≥ 24 px and primary mobile actions ≥ 44 px.
- Safe areas: fixed bottom elements add `env(safe-area-inset-bottom)`.
- `100dvh` for full-height layouts so mobile browser chrome does not clip.

## Testing

Screenshot every component page and every mock at 360×800, 768×1024 and
1280×800 (the mocks skill ships `screenshot_mocks.py`; it works on
`docs/design-system` too with `--out`). Check: no horizontal page scroll, no
clipped text, controls remain ≥ 24 px, dialogs become sheets, navigation
collapses, tables scroll inside their wrapper.
