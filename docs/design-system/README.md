# FaithTech Community design system

Extracted from [docs/mocks](../mocks/README.md) on 2026-10-21. Open [index.html](index.html) locally in Chrome.

The mocks were styled with the Shelfie design system unchanged plus FaithTech additions in `docs/mocks/assets/ui-extra.css`. This system keeps Shelfie's tokens and shared components (violet accent, rounded system type, 44px controls) until FaithTech brand colours are supplied, promotes the FaithTech additions into `assets/components.css`, and documents every page with FaithTech content. Every component here is built once in `frontend/projects/components/` (see AGENTS.md).

## Foundations

| Page | Covers |
|---|---|
| [Color](foundations/color.html) | Palette ramps, semantic roles, both themes, every contrast pair live. |
| [Typography](foundations/typography.html) | Rounded system sans, nine sizes, twelve role shorthands. |
| [Spacing](foundations/spacing.html) | 4px scale, inside vs between. |
| [Layout](foundations/layout.html) | Container, stack, cluster, grid, split, page header. |
| [Elevation](foundations/elevation.html) | Shadows, surface hierarchy, z-order. |
| [Shape](foundations/shape.html) | Radii, border widths, avatar sizes. |
| [Motion](foundations/motion.html) | Durations, easings, reduced motion. |
| [Iconography](foundations/iconography.html) | Stroke icons from the mocks, sizes, labelling. |
| [Theming](foundations/theming.html) | data-theme, OS preference, tiers, tokens.json. |
| [Responsive](foundations/responsive.html) | Mobile-first rules per component, touch, test matrix. |
| [Accessibility](foundations/accessibility.html) | WCAG 2.2 AA commitments and component contract. |
| [Content](foundations/content.html) | Voice, casing, dates, error and empty formulas, microcopy. |

## Components

| Component | Covers |
|---|---|
| [Button](components/button.html) | Primary, secondary, ghost, danger; sm/md/lg; busy. |
| [Link](components/link.html) | Inline and standalone links. |
| [Menu](components/menu.html) | Account menu off the avatar. |
| [Form field](components/form-field.html) | Label, help, error wrapper. |
| [Text field](components/text-field.html) | Text, email, password, search, input group. |
| [Textarea](components/textarea.html) | Bios, notes, announcement body. |
| [Select](components/select.html) | Native select for roles, cities, event types. |
| [Radio group](components/radio-group.html) | Choice rows with descriptions. |
| [Switch](components/switch.html) | Notification and email preferences. |
| [Form layout](components/form-layout.html) | Actions bar, error summary, danger zone. |
| [Picture list](components/picture-list.html) | Profile photos: up to 10, one featured, alt text. |
| [Estimate card picker](components/sticker-picker.html) | Planning poker vote cards. |
| [Top bar](components/top-bar.html) | App header with nav, search, bell and avatar. |
| [Tab bar](components/tab-bar.html) | Phone navigation. |
| [Tabs](components/tabs.html) | Section tabs and in-page tab panels. |
| [Breadcrumb](components/breadcrumb.html) | Two and three levels. |
| [Skip link](components/skip-link.html) | First stop for keyboard users. |
| [Layout primitives](components/layout.html) | Container, stack, cluster, grid, split, page header. |
| [Card](components/card.html) | Surfaces for grouped content. |
| [Dialog](components/dialog.html) | CDK dialogs: default, destructive, form, busy, failed; the shared role dialog. |
| [Notification panel](components/notification-panel.html) | Bell panel with unread notices. |
| [List](components/list.html) | People, contacts and invites lists. |
| [Table](components/table.html) | Audit log and admin tables. |
| [Description list](components/description-list.html) | Profile and contact facts. |
| [Activity feed](components/feed.html) | Activity on contacts and partners. |
| [Backlog tree](components/tree.html) | Initiatives, epics, stories, tasks. |
| [Kanban board](components/kanban.html) | Partner pipeline and team board. |
| [Event card](components/event-card.html) | Date badge, title, meta, cancelled. |
| [Profile header](components/profile-header.html) | Avatar, name, roles, photo strip. |
| [Search results](components/search-results.html) | Grouped global search with highlights. |
| [Note](components/note.html) | Private notes on contacts. |
| [Avatar](components/avatar.html) | Initials, colours, sizes, trigger. |
| [Logo mark](components/logo-mark.html) | FaithTech mark on auth screens. |
| [Badge](components/badge.html) | Roles, status, counts. |
| [Chip](components/chip.html) | Filter toggles. |
| [Stat](components/stat.html) | Label and value. |
| [Estimate card](components/sticker.html) | Revealed planning poker votes. |
| [Toast](components/toast.html) | Info, success, warning, danger; with action. |
| [Alert and banner](components/alert.html) | Inline alerts and page banners. |
| [Inline message](components/inline-message.html) | Field errors and save status. |
| [Progress](components/progress.html) | Determinate progress. |
| [Skeleton](components/skeleton.html) | Loading placeholders, including the loading list. |
| [Empty state](components/empty-state.html) | First-run, no results, error; page-level heading for full-page errors. |
| [Error page](components/error-page.html) | 404, 403, 500, offline. |

Each component page documents variants, sizes and the full state matrix in both themes, and its Sources section lists the mocks it came from.

## Patterns

| Pattern | Covers |
|---|---|
| [Forms](patterns/forms.html) | Validation timing, error summary, submit states. |
| [Feedback and loading](patterns/feedback-and-loading.html) | Which feedback for which action. |
| [Empty and error states](patterns/empty-and-error-states.html) | Copy formulas and recovery. |
| [Navigation and page structure](patterns/navigation.html) | Shell, page header, tabs, back behaviour. |
| [Dialogs and overlays](patterns/dialogs-and-overlays.html) | Dialog vs page vs panel; destructive confirms. |
| [Lists and tables](patterns/lists-and-tables.html) | Lists, tables, Kanban, backlog. |
| [Notifications](patterns/notifications.html) | Bell, toast, banner, email. |
| [Content and tone](patterns/content-and-tone.html) | Voice, verbs, dates, microcopy. |

## Tokens

- `tokens/tokens.css` — source of truth: primitives, semantic tokens, light and dark themes.
- `tokens/tokens.json` — DTCG export generated from `tokens.css` (330 tokens).
- `tokens/contrast-pairs.json` — every fg/bg pair the components rely on, checked in both themes.
- `assets/components.css` — the component stylesheet, token-driven, with `data-state` hooks for documentation.

## Changelog

- 2026-10-21 — First extraction. Tokens inherited from Shelfie unchanged except comments. Added: select, tabs, notification panel, description list, backlog tree, Kanban board, event card, profile header, search results, note (from `ui-extra.css`). Select chevron redrawn with `currentColor` (was raw `#888`). Added state hooks: event card title hover, select hover/disabled, tab hover, tree row hover, `stat__value--text`, square checkboxes in `.choice`. Renamed for FaithTech: sticker → Estimate card, sticker picker → Estimate card picker (class names unchanged). Dropped Shelfie-only components (book cover, streak, trophy, celebration and others) and the e-mail foundation.

## Drift found in the mocks

| Mock | Issue | Resolution |
|---|---|---|
| dialogs/* (destructive) | Autofocus lands on the danger button | Documented: focus starts on Cancel |
| dialogs/* | `dialog__icon--danger` used only on archive-workspace and remove-workspace-member | Documented: every destructive confirm uses it |
| dialogs/* busy | Fields stay editable; `disabled` and `aria-disabled` mixed | Documented: busy disables the form, `aria-busy` on the confirm button |
| dialogs/cancel-event, cancel-rsvp | "Cancel" dismiss sits beside "Cancel event" / "Cancel RSVP" | Documented: dismiss reads "Keep event" / "Keep RSVP" |
| dialogs/* failed | Every failure titled "That didn't work" | Documented: error formula names what failed |
| dialogs/send-invite | Typo "Create Lead"; offers roles a City Lead may not grant | Flagged for the mocks |
| pages/* | About 110 card headings use inline `font` instead of `.card__title`; inline padding and widths | Use `.card__title` and layout primitives |
| notifications/bell | Bell is a link with `aria-expanded` | Documented: a `<button>` when it opens the panel |
| assets/ui-extra.css | Raw `14rem`, `12rem`, `24rem`, `9rem`, `7rem` sizes, `63.99rem` breakpoint, `!important` on `.photo-ph`, raw `#888` chevron | Chevron redrawn with `currentColor`; the unused `.photo-ph` removed; sizes logged for a later token pass |
| pages/edit-profile | Remove is a link; Feature buttons not named per photo; grid not wrapped in `.picture-list`; empty, full, wrong-type states missing | Fixed in the mocks (#70 to #74) |
| pages/planning-poker | No invalid, withdrawn or failed vote states; revealed "?" never shown | Invalid, withdrawn and vote-failed states mocked; `ft-estimate-picker` gains `error`; Ruth's revealed vote is "?" (Unsure) in `revealed`, `facilitator` and `agreed` |
| pages/* breadcrumbs | Some state mocks label the current crumb generically ("Event") | Documented: the current crumb is the record name |
| pages/* | Top bar and tab bar copied by hand into every mock, varying by role | One shell component in the app |
| pages/events, pages/search (loading) | Round avatar skeletons where rows have square date badges | Documented on Event card and Search results |
| pages/profile | Samuel's photos copied from Grace's, with alt text describing her (fixed, #76); loading uses text skeletons for square tiles (fixed, #77) | Fixed in the mocks |
| pages/public-event/cancelled | Says "FaithTech Toronto" and Kestrel Labs for the Austin panel | Flagged for the mocks |
| pages/search, invites, announcements, workspaces | Rows borrow `.sticker` as an icon tile | Fixed: `.icon-tile`; the estimate card and picker are `.estimate-card` and `.estimate-choice`, and the unused `.sticker__img`, `--xl` and `--bob` are removed |
| pages/contact | Gap between note text and date relies on default paragraph margins | `.note__meta` owns the gap |
| assets/ui-extra.css | `.event-card__title` had no `data-state="hover"` hook | Added in components.css |
| notifications/toast (rsvp failed) | "Retry" where every other failure says "Try again" | Content page: always "Try again" |
| pages/* tab bar | No Workspaces, Team, Announcements or People; Team, Announcements, People also hidden in the top bar at 768–1023px | Flagged: those pages need a route at tablet width |
| assets/ui-extra.css | Secondary nav hidden with a min/max range query | Logged; system rule is min-width queries only |
| pages/* | Bell panel uses `--z-dropdown`; `--color-tint-*`, `--size-cover-*`, `avatar--lg` unused | Logged; panels move to `--z-popover` in the app |
| pages/* | Inline raw sizes: Kanban skeleton `4rem`, action filter `14rem`, toast note `9rem` | Logged; use spacing tokens and layout primitives |
| pages/not-found, server-error, offline | "Try again" is an `<a href>` styled as a button | Documented: a `<button>` |
| pages/backlog | View chips are links with `aria-pressed` | Documented: links use `aria-current` |
| pages/* | About 65 Task badges have a trailing space in `class` | Logged |
| pages/events, pages/team | Filter rows have no group or label | Documented: `role="group"` with `aria-label` |
| dialogs/start-poker/invalid | Group error not linked to the fieldset; no `aria-invalid` | Documented on Form field |
| notifications/toast/danger | `role="alert"` on the region instead of the toast | Documented on Toast |
| notifications/banner | Only the danger banner had a role | Fixed: info, success and warning banners use `role="status"` |
| pages/* | No loading, empty or error states for feed or stats; no row hover/focus; no busy Export CSV; offline page has no banner | Documented as system states |
| pages/* | Avatar colours chosen by hand, some people share one | Documented: colour derived from the person id |
| pages/event-form | Summary wording differs from the field error | Documented: the summary repeats the field error |
| notifications/toast | Warning and danger toasts show a timer bar though they persist | Documented: only auto-dismissing toasts show it |
| pages/audit-log/loading | List skeleton rows on a table | Documented: table skeleton rows |
| assets/logo.svg | Hard-coded colours | Logged; brand asset |
| notifications/bell (empty) | "Mark all read" shown with nothing unread; inline padding | Documented on Notification panel |
| pages/notifications | Notices out of time order | Documented: newest first |
| pages/team-board | Cards draggable with no Move action | Fixed: every movable story card has Move, opening the new `dialogs/move-story` |
| assets/components.css | `.kanban--4` and `.kanban__empty` unused by any mock | `.kanban--4` removed from the CSS and `ft-kanban-board` (every workflow has three stages); `team-board/kanban` shows an empty Done column with `.kanban__empty` |
| pages/partners | Move is a link; dragging uses deprecated `aria-grabbed` with no live region | Fixed: Move is a `<button type="button">` naming the dialog in `data-href`; `aria-grabbed` removed from the mocks and CSS (`data-state="dragging"` only); `partners/default` and `dragging` carry the polite live region |
| dialogs/move-partner, move-story | Radios have no `value` | Fixed: each radio carries the API value (`Lead`, `InFunnel`, `Confirmed`; `ToDo`, `InProgress`, `Done`) |
| pages/backlog | Title link nested inside `<summary>`; no collapsed branch mocked | Fixed: branches use a `.tree__toggle` disclosure button beside the title link (mocks, CSS and `ft-tree-item`); the backlog mocks show a collapsed done story |
| pages/* tabs | 36 tab rows carry inline `margin-bottom` | Logged |
| pages/* filters | Selects wrapped in inline `width: 12rem`; select disabled/hover hooks missing | Hooks added to components.css |
| dialogs/new-work-item/invalid | Parent select has no `<label for>` | Documented on Select |
| pages/profile, pages/contact | Emails not `mailto:` links | Documented on Description list |
| dialogs/add-workspace-member, create-workspace, start-poker | Checkboxes in `.choice` rows drew as round radios | Square checkbox rule added to components.css, documented on Radio group; `ft-checkbox-group` + `ft-checkbox` added to the components library |
| dialogs/* busy | Busy buttons hold a hidden `dot--pulse`; `aria-disabled` beside `disabled` | Documented on Button: spinner + `aria-busy`, siblings `disabled` |
| pages/* forms vs dialogs | Primary before Cancel on pages, after Cancel in dialogs | Documented: primary last (right) everywhere |
| pages/* forms | Error summary is a `ul` with inline padding; CSS styles `.form-summary ol` | Documented: `ol` |
| pages/* forms | Optional marker was `span.text-muted`, not `.optional` | Fixed: mocks and `ft-form-field` use `.optional` (`--color-fg-subtle`) |
| pages/compose-announcement | Only field labelled "(optional)"; `rows="2"` overridden | Logged; `rows` fixed: the textarea has no minimum height |
| pages/edit-profile | 400-character bio limit had no counter; show-password never pressed | Fixed: `.field__count` counter and over-limit state; sign-in/invalid shows the pressed toggle |
| pages/event-form | Visibility legend was visually hidden | Fixed: the legend is visible (`legend.field__label`) |
| pages/settings | Email switch caption not joined with `aria-describedby`; only "Sign out everywhere" | Documented on Switch and Menu |
| dialogs/remove-role | A single pre-checked radio | Logged |

## Verification

Run on 2026-10-21:

```sh
python .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks            # 66 screens, 303 mocks, 0 errors
python .claude/skills/extracting-design-systems/scripts/check_contrast.py docs/design-system/tokens/tokens.css   # 206 passed, 0 failed, 0 unresolved (light and dark)
python .claude/skills/extracting-design-systems/scripts/check_design_system.py docs/design-system                 # 65 pages (44 components, 8 patterns), 0 errors, 0 warnings
```

Screenshots: index, color, button, Kanban board and dialog at 360 and 1280 px in both themes: no horizontal overflow, no console errors, dark surfaces read as raised. The mocks now load `tokens/tokens.css` and `assets/components.css` from here (their copies and `ui-extra.css` were removed); after the switch the mocks checker reports 66 screens, 303 mocks, 0 errors, and re-shot add-workspace-member and event-form mocks render correctly (square checkboxes, themed select chevron). The select chevron is now a filled triangle rather than the mocks' stroked chevron: accepted drift.
