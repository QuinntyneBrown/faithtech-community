# What makes a mock a delight

"Delightful" is not decoration. It is the feeling that the product anticipated
what the person needs, never makes them wait without explanation, never loses
their work, and never makes them guess. Each principle below has a concrete
test. Apply all of them to every mock; the review checklist at the end is what
the final pass uses.

## Hierarchy and rhythm

- One clear primary action per screen (`.btn--primary`); everything else is secondary, ghost or a link. Two primaries on one screen is a bug.
- Page title, then a one-line subtitle with the numbers that matter (`38 active · 2 overdue`). The person should know the state of their world before reading further.
- Spacing comes from the scale only (`--space-*`); related things sit closer (`--space-2`/`--space-3`) than unrelated things (`--space-6`/`--space-8`). Sections breathe at `--space-8`+.
- Line length stays within `--layout-measure`; numbers align right and use `font-variant-numeric: tabular-nums`.
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`; nothing wraps into a widow of one word if you can help it.

## Content first

- Real copy, real names, real numbers, real dates. Never "Lorem ipsum", "John Doe", "Item 1", "Lorem Corp". Invent a plausible dataset for the product (the same people and items across every mock so the story holds together).
- Sentence case for everything except product names. Labels are nouns ("Due date"), buttons are verbs ("Renew loan"), never "OK"/"Submit"/"Yes".
- Dates are human ("Tomorrow", "Fri 17 Oct", "3 days overdue") with the exact timestamp available on hover or in a tooltip.
- Numbers get thousands separators and units; percentages get one decimal at most.
- Every truncation has a tooltip or title with the full value.

## Empty states that teach

- Say what this area is, why it is empty, and the single next action. An illustration or icon helps; a wall of text does not.
- Distinguish **first-run empty** ("No loans yet. Create the first one.") from **filtered empty** ("No loans match these filters." + Clear filters) from **permission empty** ("You can't see loans for this branch. Ask an admin.").
- Never show an empty table header row with nothing under it; replace the table with the empty state.

## Loading that respects attention

- Under ~300 ms: nothing. Flashing a spinner for 100 ms is worse than nothing.
- Initial load: skeletons shaped like the real content (`.skeleton--title`, `.skeleton--text`, rows with the same column widths). No layout shift when data arrives.
- Action in flight: the button that was pressed shows the busy state (`aria-busy="true"`); the rest of the screen stays usable unless the action genuinely blocks it.
- Long operations (>2 s): a progress bar with a determinate value when known; otherwise `.progress--indeterminate` plus text that says what is happening.
- Optimistic updates for low-risk actions (toggle a favourite, rename) with an undo toast if they fail.

## Errors that help

- Say what happened in plain words, what the person can do, and offer the action right there (Retry, Go back, Contact support with a reference code).
- Field errors sit under the field, start with what to fix ("Enter an e-mail address like name@example.com"), and the field is marked `aria-invalid="true"` with `aria-describedby` pointing at the message.
- A form with errors also gets a summary at the top listing each error as a link to its field; focus moves there on submit.
- Never clear the person's input on error. Never show a stack trace, an HTTP code alone, or "Something went wrong" without a next step.
- Destructive actions: confirm once, say exactly what is lost, name the thing ("Delete 'Q3 budget'?"), make the danger button red and not the default focus, and prefer Undo over confirmation when the action is reversible.

## Motion with purpose

- Motion explains where something came from or went: dialogs scale in from centre, sheets slide from the edge they anchor to, toasts rise from the bottom, menus grow from their trigger.
- Durations from `--duration-*` only: 120 ms hover, 200 ms reveal, 320 ms dialogs. Nothing over 500 ms except progress.
- Every animation disappears under `prefers-reduced-motion` (tokens.css already zeroes the durations; do not add raw `transition:` values).
- No animation on page load except skeleton shimmer.

## Feedback for every action

- Every click has a visible response within 100 ms: pressed state, busy state, a toast, a navigation.
- Success toasts are short, specific, and offer Undo when possible; they auto-dismiss (8 s) and pause on hover/focus. Error toasts never auto-dismiss.
- Saving is visible: "Saved" with a timestamp, or an inline status with a dot that pulses while saving.
- Counts update where the person is looking (badge in the nav, subtitle numbers), not just in a toast.

## Keyboard and pointer parity

- Everything reachable with Tab in a sensible order; focus visible everywhere using the shared ring.
- Dialogs trap focus, start on the first field or the safe action, and close on Escape; focus returns to the trigger.
- Menus open with Enter/Space/ArrowDown, move with arrows, close with Escape.
- Shortcuts are hinted where they exist (`<kbd>` in menus and tooltips).
- Hover-only affordances (row actions) are also visible on focus and always visible on touch.

## Small touches that compound

- Autofocus the first field on forms that are the point of the page (sign in, search).
- Remember recent choices (last sort, last filter) and show them as defaults.
- Show the keyboard shortcut and the count ("Export 38 loans") on actions that act on a set.
- Use an avatar with initials and a stable per-person colour where there is no photo.
- Timestamps relative and absolute; relative in lists, absolute on detail pages.
- Links look like links (underlined); buttons look like buttons. Never a `<div onclick>`.
- Tooltips on icon-only buttons, always, and the icon-only button still has `aria-label`.

## Review checklist (use for every mock)

- [ ] One primary action; the eye lands on the title, then the numbers, then the action.
- [ ] Real copy and data consistent with the other mocks; no placeholders.
- [ ] Every state that can happen on this screen has a file (see `screen-inventory.md`).
- [ ] Loading mock uses layout-matching skeletons; error mock keeps the chrome and offers a way forward.
- [ ] Empty mock explains and offers the one next step.
- [ ] Forms: labels, help, inline errors, summary, `aria-invalid`, `aria-describedby`, busy state.
- [ ] Dialogs: `role="dialog"`, `aria-modal`, `aria-labelledby`, page behind `inert`, Escape and close button, bottom sheet under 640px.
- [ ] Toasts in a live region, dismissible, with Undo where reversible; errors persistent.
- [ ] Works at 360, 768 and 1280 px with no horizontal scroll (tables may scroll inside `.table-wrap`).
- [ ] Light and dark both look intentional; nothing hard-coded outside tokens.
- [ ] Keyboard: tab order, visible focus, Escape closes, Enter submits.
- [ ] Touch targets ≥ 24 px (44 px for primary mobile actions); hover-only affordances have a touch equivalent.
- [ ] Motion only where it explains something; respects reduced motion.
