# Accessibility requirements (WCAG 2.2 AA)

The design system is accessible by construction: every component page states
its role, keyboard model, focus behaviour, contrast and reduced-motion
behaviour, and the checker scripts enforce the mechanical parts. This is the
checklist the `foundations/accessibility.html` page documents and every
component page's `#accessibility` section answers.

## Perceivable

| Requirement | SC | Rule in this system |
|---|---|---|
| Text contrast | 1.4.3 | Body, label and secondary text ≥ 4.5:1 against every surface it sits on; large text (≥ 24px, or ≥ 18.7px bold) ≥ 3:1. Pairs live in `tokens/contrast-pairs.json`. |
| Non-text contrast | 1.4.11 | Input borders, focus rings, icons that carry meaning, chart marks, switch tracks ≥ 3:1 against adjacent colours. Decorative dividers are exempt and documented as such. |
| Use of colour | 1.4.1 | Status is colour + icon + text; links are underlined; required fields say "required"; charts use pattern or labels. |
| Resize and reflow | 1.4.4, 1.4.10 | All sizes in `rem`; layouts reflow to 320px CSS width with no two-dimensional scroll except data tables and maps. |
| Text spacing | 1.4.12 | Nothing breaks when line height is 1.5×, paragraph spacing 2×, letter spacing 0.12em, word spacing 0.16em. |
| Images | 1.1.1 | Informative images have `alt`; decorative SVGs have `aria-hidden="true"`; icon-only controls have `aria-label`. |
| Orientation and motion | 1.3.4, 2.3.3 | No orientation lock; every animation respects `prefers-reduced-motion` (durations are zeroed in tokens). |
| Identify input purpose | 1.3.5 | `autocomplete` on name, e-mail, address, phone, credit-card fields. |

## Operable

| Requirement | SC | Rule in this system |
|---|---|---|
| Keyboard | 2.1.1, 2.1.2 | Everything operable with Tab/Shift+Tab, Enter/Space, arrows where a widget pattern says so; no keyboard traps except modal dialogs, which release on Escape. |
| Focus visible | 2.4.7 | One shared ring: 2px `--color-focus-ring` with 2px offset on `:focus-visible`; ≥ 3:1 against adjacent colours (2.4.11 focus appearance). |
| Focus not obscured | 2.4.11 | Sticky headers, toasts and cookie banners never cover the focused element; `scroll-padding-top` matches the topbar height. |
| Focus order | 2.4.3 | DOM order is visual order; no positive `tabindex`; dialogs move focus in and restore it on close. |
| Target size | 2.5.8 | ≥ 24×24 CSS px for every target, 44×44 for primary mobile actions; adjacent small targets have 24px spacing. |
| Dragging | 2.5.7 | Any drag interaction (sliders, reorder, resize) has a single-pointer alternative (buttons, inputs). |
| Timing | 2.2.1, 2.2.2 | Auto-dismissing toasts last ≥ 8 s, pause on hover/focus, and errors never auto-dismiss; carousels and tickers can be paused. |
| Skip | 2.4.1 | A skip link to `#main` on every page; landmarks `header`, `nav`, `main`, `footer`. |
| Page titles and headings | 2.4.2, 2.4.6 | Unique `<title>` per page, one `<h1>`, headings in order. |
| Link purpose | 2.4.4 | Link text makes sense alone ("View invoice INV-204", not "click here"). |
| Pointer cancellation | 2.5.2 | Actions fire on `click`/keyup, never on `mousedown`. |

## Understandable

| Requirement | SC | Rule in this system |
|---|---|---|
| Labels | 3.3.2 | Visible label for every control; placeholders are hints, never labels; required state in the label text. |
| Error identification and suggestion | 3.3.1, 3.3.3 | Error text names the field and says how to fix it; `aria-invalid="true"` + `aria-describedby`; a summary links each error to its field; focus moves to the summary on submit. |
| Error prevention | 3.3.4 | Destructive and financial actions are confirmable, reversible (Undo) or reviewed before submit. |
| Redundant entry | 3.3.7 | Information already entered in a flow is pre-filled or selectable. |
| Accessible authentication | 3.3.8 | No cognitive tests; paste and password managers allowed; e-mail or passkey alternatives documented. |
| Consistent navigation and identification | 3.2.3, 3.2.4 | Same components, same order, same names on every page; icons mean one thing. |
| Language | 3.1.1 | `<html lang>` on every page; `lang` on inline foreign phrases. |
| On input | 3.2.2 | Changing a select or checkbox never navigates or submits by itself. |
| Help | 3.2.6 | Help link in the same place on every page. |

## Robust

| Requirement | SC | Rule in this system |
|---|---|---|
| Name, role, value | 4.1.2 | Native elements first (`button`, `a`, `input`, `select`, `details`, `dialog` where supported); ARIA only to fill gaps, following the WAI-ARIA Authoring Practices patterns named on each component page. |
| Status messages | 4.1.3 | Toasts in `role="status"` (polite) or `role="alert"` (assertive for errors); counts and "Saved" indicators in live regions. |
| Valid HTML | – | No duplicate ids, nesting rules respected (no block inside `button`, no interactive inside interactive). |

## Component page contract

Every component page's `#accessibility` section contains:

1. **Role and pattern** – the element or ARIA pattern used, with a link to the WAI-ARIA Authoring Practices Guide pattern.
2. **Keyboard map** – a table of keys and effects (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Esc`, arrows, `Home`/`End`, type-ahead).
3. **Focus** – where focus starts, where it goes on close, how the ring looks.
4. **Labelling** – what must be labelled, how, and what is announced.
5. **Contrast** – the token pairs involved and their ratios in both themes (live via `data-contrast`).
6. **Motion** – what animates and what happens with reduced motion.
7. **Touch** – target sizes and hover alternatives.

## Testing

- `scripts/check_contrast.py` for every declared pair, both themes.
- `scripts/check_design_system.py` for labels, names, alt text, landmarks, headings, links.
- Manual: Tab through each component page's examples; use a screen reader on one dialog, one form and one table; zoom to 200% and 400%; emulate `prefers-reduced-motion` and `forced-colors`.
