# Component catalog

The components to extract, what each must document, and the variants and
states its page must show. Extract every component that appears in the mocks
**plus** the core set (marked ★), which every product needs even when a mock
has not used it yet. One HTML file per component in
`docs/design-system/components/<name>.html`, named in kebab-case singular.

Every component page shows **all** of the following in its state matrix, with
`data-state` forcing the pointer/focus states statically:

- Interaction states: `default`, `hover`, `focus-visible`, `active`, `disabled`
- Where they exist: `loading`/`busy`, `selected`/`checked`/`pressed`, `invalid`, `read-only`, `indeterminate`, `expanded`/`open`, `current`
- Both themes, side by side, via `.ds-themes` with `[data-theme="light"]` and `[data-theme="dark"]` wrappers
- Every size and every colour variant listed below

## Actions

| Component | ★ | Variants | Sizes | Extra states | ARIA pattern / notes |
|---|---|---|---|---|---|
| Button | ★ | primary, secondary (default), ghost, link, danger; with leading/trailing icon; icon-only; block | sm, md, lg | loading, pressed (`aria-pressed`), expanded (`aria-expanded`) | `<button>`; icon-only needs `aria-label`; loading keeps width and sets `aria-busy`. |
| Button group | | segmented (single select), toolbar | sm, md | pressed | `role="group"` with `aria-label`; segmented uses `aria-pressed`. |
| Link | ★ | inline, standalone with icon, external | – | visited | Underlined; external links announce "opens in new tab". |
| Menu (dropdown) | ★ | with icons, with shortcuts, with sections, danger item, checkable items | – | item disabled, checked | APG Menu Button: `aria-haspopup`, `aria-expanded`, arrow keys, type-ahead, Esc. |

## Inputs

| Component | ★ | Variants | Sizes | Extra states | ARIA pattern / notes |
|---|---|---|---|---|---|
| Text field | ★ | text, e-mail, password (with show toggle), number, search, with prefix/suffix addon, with icon, with character counter | sm, md, lg | invalid, read-only, required | `<label for>`; help and error via `aria-describedby`; `aria-invalid`. |
| Textarea | ★ | auto-grow, with counter | md | invalid, read-only | Same as text field; `rows` minimum 2. |
| Select | ★ | native, with placeholder option | sm, md, lg | invalid | Native `<select>` by default; custom listbox only when native cannot do the job, then APG Listbox. |
| Combobox / autocomplete | | single, multi (with chips), async with loading and no-results | md | open, loading, no results | APG Combobox: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`. |
| Checkbox | ★ | single, group, with description | – | checked, indeterminate, invalid | Native input; group in `<fieldset>` with `<legend>`. |
| Radio group | ★ | vertical, horizontal, card-style | – | checked, invalid | Native inputs in `<fieldset>`; arrows move selection. |
| Switch | ★ | with label left/right, with description | – | on, off | `role="switch"` on a checkbox input; Space toggles; label describes the setting, not the action. |
| Slider | | single, range, with value label and ticks | – | – | Native `<input type="range">` first; drag has a keyboard alternative. |
| Date picker | | single date, range, with presets | md | invalid | Native `type="date"` as baseline; custom grid uses APG Date Picker Dialog with `role="grid"`. |
| File upload | | drop zone, button, with file list and progress | – | dragging, uploading, failed | `<input type="file">` is the control; drop zone is an enhancement. |
| Form field (wrapper) | ★ | label + help + error + counter | – | – | The layout primitive every input uses; documents spacing between parts. |
| Form layout / fieldset | ★ | single column, two column, inline, actions bar, error summary | – | submitting | Submit button busy state; error summary with links; `novalidate` + custom messages. |

## Navigation

| Component | ★ | Variants | Sizes | Extra states | ARIA pattern / notes |
|---|---|---|---|---|---|
| Top bar / app header | ★ | with search, with actions, with tabs, compact (mobile) | – | – | `<header>` with `<nav aria-label>`; menu button `aria-expanded` + `aria-controls`. |
| Sidebar navigation | ★ | grouped, collapsible groups, with badges, collapsed to icons | – | current, expanded | `aria-current="page"`; collapsible groups use `<details>` or `aria-expanded`. |
| Tabs | ★ | underline, pill, with counts, scrollable | sm, md | selected, disabled | APG Tabs: `role="tablist/tab/tabpanel"`, arrows move, automatic or manual activation (say which). |
| Breadcrumb | ★ | full, collapsed with ellipsis menu | – | current | `<nav aria-label="Breadcrumb">`, `aria-current="page"`. |
| Pagination | ★ | numbered, simple prev/next, with page size | – | current, disabled | `<nav aria-label="Pagination">`; current page `aria-current`. |
| Stepper / progress steps | | horizontal, vertical, with descriptions | – | current, complete, error | `<ol>`; `aria-current="step"`. |
| Footer | | simple, multi-column | – | – | `<footer>` landmark. |
| Skip link | ★ | – | – | focused | First focusable element; visible on focus. |
| Command palette | | – | – | open, loading, no results | Dialog + combobox; `Ctrl/Cmd+K`. |

## Containers and overlays

| Component | ★ | Variants | Sizes | Extra states | ARIA pattern / notes |
|---|---|---|---|---|---|
| Card | ★ | default, interactive (whole card clickable), with header/footer, flush media, selected | – | hover, selected | A clickable card has one real link/button; the card is not the control. |
| Accordion | | single-open, multi-open, with icons | – | expanded | `<details>/<summary>` or APG Accordion with `aria-expanded` + `aria-controls`. |
| Dialog (modal) | ★ | default, destructive (danger icon + red confirm), form, scrollable, full-screen (mobile sheet) | sm, md, lg | busy, invalid, failed | APG Dialog: `role="dialog" aria-modal`, labelled, focus trapped, Esc closes, returns focus; backdrop; page `inert`. |
| Drawer / sheet | | right, left, bottom | – | busy | Same as dialog; slides from its edge; full width on phones. |
| Popover | | with title, with actions, with form | – | open | `aria-haspopup="dialog"`, `aria-expanded`; Esc closes; focus moves in only when it has interactive content. |
| Tooltip | ★ | text, with shortcut | – | visible | `role="tooltip"` + `aria-describedby`; shows on hover **and** focus; never contains interactive content; delay 300 ms in, 0 out. |
| Divider | ★ | horizontal, vertical, with label | – | – | `<hr>` or `role="separator"`. |
| Container / grid / stack | ★ | container, grid, stack, cluster | – | – | The layout primitives; document gutters, margins and breakpoints with a live grid demo. |

## Data display

| Component | ★ | Variants | Sizes | Extra states | ARIA pattern / notes |
|---|---|---|---|---|---|
| Table | ★ | default, dense, sortable, selectable (checkbox column + bulk bar), with row actions, sticky header, with expandable rows, responsive (scroll vs cards) | sm, md | loading (skeleton rows), empty, error, row hover, row selected | `<table>` with `<caption>`, `scope`; sort via `aria-sort`; keyboard reach to row actions. |
| List | ★ | simple, two-line, with avatar/icon, interactive, with dividers | – | hover, selected | `<ul>`; interactive items are links or buttons. |
| Description list (key-value) | ★ | horizontal, vertical | – | – | `<dl>`. |
| Avatar | ★ | image, initials, icon; group with overflow; with status dot | sm, md, lg | – | Decorative when next to the name; otherwise `alt`/`aria-label`. |
| Badge / status | ★ | neutral, info, success, warning, danger; solid; count | – | – | Dot + text; counts have `aria-label` with meaning. |
| Chip / tag | ★ | filter (toggle), input (removable), static | sm, md | selected, hover | Filter chips use `aria-pressed`; removable chips have a labelled remove button. |
| Stat / KPI | | with delta, with sparkline placeholder | – | loading | Tabular numbers; delta colour + arrow + sign. |
| Code block | | inline, block with copy | – | copied | `<pre><code>`; copy button announces. |
| Timeline / activity feed | | – | – | – | `<ol>` with time elements. |

## Feedback

| Component | ★ | Variants | Sizes | Extra states | ARIA pattern / notes |
|---|---|---|---|---|---|
| Toast | ★ | info, success, warning, danger; with action (Undo/View/Retry); stacked | – | leaving | `role="status"` region (polite); errors `role="alert"`; dismiss button; timer pauses on hover/focus; errors persist. |
| Alert / banner | ★ | inline alert (4 tones), page banner (persistent), with actions, dismissible | – | – | `role="alert"` only for new, important content; otherwise `role="status"` or plain. |
| Inline message | ★ | field hint, field error, success | – | – | Linked with `aria-describedby`. |
| Progress bar | ★ | determinate, indeterminate, with label and value, success/danger | – | – | `role="progressbar"` with `aria-valuenow/min/max` or `aria-busy`. |
| Spinner | ★ | sm, md, lg; inline with text | – | – | `role="status"` with visually hidden text ("Loading loans"). |
| Skeleton | ★ | text, title, circle, rect, composed card/row | – | – | `aria-hidden`; the container has `aria-busy="true"`. |
| Empty state | ★ | first-run, no results (filters), permission, error (as empty) | compact, full | – | Icon/illustration, title, one sentence, one primary action, optional secondary link. |
| Error page | ★ | 404, 403, 500, offline, maintenance | – | – | Keeps the shell when possible; one action to recover; reference id for 500. |

## Patterns (one page each in `patterns/`)

Patterns compose components for a job and document the rules that span them:

| Pattern | Covers |
|---|---|
| Forms | Layout, label placement, validation timing (on blur, re-validate on input), error summary, submit states, autosave, destructive confirmations. |
| Feedback & loading | Which feedback for which action: inline, toast, banner, dialog; skeleton vs spinner vs progress; optimistic updates and undo. |
| Empty & error states | Copy formulas, when to use which, illustrations. |
| Navigation & page structure | Shell, page header, breadcrumbs, tabs vs sub-pages, back behaviour. |
| Dialogs & overlays | When to use dialog vs drawer vs popover vs page; stacking; mobile sheets. |
| Data tables & lists | Density, sorting, filtering, selection, bulk actions, pagination vs infinite scroll, responsive strategy. |
| Notifications | Toast vs banner vs notification center; priority; grouping; auto-dismiss rules. |
| Content & tone | Voice, sentence case, button verbs, numbers/dates, error message formula, microcopy library. |

## Component page sections (fixed order, checked by `check_design_system.py`)

`overview`, `anatomy`, `variants`, `sizes`, `states`, `responsive`, `theming`,
`accessibility`, `content`, `do-dont`, `tokens`, `code`, `sources`. A section
that does not apply stays in the page with `data-na="reason"` (for example
`<section id="sizes" data-na="Tooltips have one size.">`).
