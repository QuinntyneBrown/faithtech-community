# Screen inventory and state matrix

A mock set is complete only when every screen the product can show exists as a
file, in every state it can be in. This reference tells you how to enumerate
them so nothing is forgotten, and what "every state" means for each kind.

## 1. Enumerate the screens

Walk every source you have, in this order, and list screens as you go:

| Source | What to extract |
|---|---|
| `docs/specs/L1.md`, `docs/specs/L2.md` | One page or dialog per user-facing capability; every L2 with a Given/When/Then that ends in something visible. Keep the requirement IDs; they go into the manifest and `mock:requirements` meta. |
| `docs/detailed-designs/**/README.md` | Sequence diagrams: every frontend step is a screen or a state change. |
| Router files, route tables, menu definitions, `sitemap` | Every route is a page. Nested routes are tabs or sub-pages. |
| Existing templates, components, Storybook, old mocks | Dialogs, menus, toasts that already exist. |
| The user's description | Anything mentioned once is a screen; ask only if two readings produce different page sets. |

Then add the screens every product has but nobody lists:

- **Entry**: sign in, sign up, forgot password, reset password, verify e-mail, invitation accepted, session expired, sign out confirmation.
- **Shell**: dashboard/home, global search results, notification center, account settings, profile, preferences, billing (if any), help/about.
- **Errors as pages**: 404 not found, 403 forbidden, 500 something went wrong, offline, maintenance, unsupported browser.
- **Lifecycle**: first-run/onboarding, empty workspace, trial expired, plan limits reached, deleted/archived item.
- **Legal**: terms, privacy, cookie consent (as a banner notification).

Group screens into **kinds**:

| Kind | Folder | What it is |
|---|---|---|
| `page` | `pages/<id>/` | A full route. Includes tabs within a route only if the tab changes most of the content; otherwise the tab is a state. |
| `dialog` | `dialogs/<id>/` | Modal dialog, confirmation, drawer/sheet, command palette, full-screen takeover, popover with a form, dropdown menu that carries decisions. Shown over the page it opens from. |
| `notification` | `notifications/<id>/` | Toast, snackbar, banner, inline alert, badge count, in-app notification item, cookie consent, update-available prompt, push-permission prompt. Shown on the page that triggers it. |

Use kebab-case ids that match route names where routes exist (`loans`, `loan-detail`, `return-loan`, `loan-toast`).

## 2. The state matrix

Create one file per state. The **required** states are checked by
`scripts/check_mocks.py`; the **conditional** ones are required whenever the
condition holds; the rest are expected whenever the screen has that behaviour.
A state that genuinely cannot occur is declared in the manifest under
`not_applicable` with a one-line reason; never silently skip one.

### Pages

| State | Required | Shows |
|---|---|---|
| `default` | always | Realistic populated content, mid-session, typical data volumes. |
| `loading` | always | Skeletons that match the final layout (not a spinner on a blank page) while the first request is in flight. |
| `empty` | always (`not_applicable` if the page has no collection) | First-run / nothing yet: what it is, why it is empty, the one action to take. |
| `error` | always | The page's data failed to load: what happened, what to try, a retry, a way back. Layout chrome stays. |
| `no-results` | lists with search or filters | Filters active, nothing matched; the filters stay visible and clearable. |
| `partial` | pages with several independent data sources | Some sections loaded, one failed; the rest still works. |
| `invalid` | pages with a form | Submitted with errors: field-level messages, an error summary at the top, focus moved to the summary. |
| `submitting` | pages with a form | Primary action busy and disabled, fields read-only, no layout shift. |
| `success` | pages with a form or a completing flow | What was done, what happens next, where to go. |
| `forbidden` | routes with permissions | The user lacks access: who to ask, and a way back. |
| `offline` | apps used on mobile or in the field | Cached content shown with an offline banner; actions queued or disabled. |
| `long` | lists, tables, feeds | Hundreds of items; pagination or virtualization visible; nothing breaks. |
| `edge` | anything with user text or numbers | Longest plausible names, 4-digit counts, wrapped titles, missing avatars, RTL names, many tags. |
| `selected` / `bulk` | lists with selection | Items selected, bulk action bar visible. |
| `read-only` / `locked` | editable content with permissions or archive | Content visible, editing affordances gone, reason shown. |

### Dialogs

| State | Required | Shows |
|---|---|---|
| `default` | always | Just opened, focus on the first field or the safest action. |
| `busy` | always | Confirm button busy; close/cancel disabled or still possible (say which); no second submit. |
| `invalid` | always (`not_applicable` if the dialog has no inputs) | Validation errors shown inline, focus on the first invalid field. |
| `failed` | dialogs that call a server | The action failed: error at the top of the dialog, inputs preserved, retry. |
| `confirm` | destructive dialogs | Extra friction for destructive actions: typed confirmation or a clearly labelled danger button. |
| `success` | dialogs that stay open after success | Confirmation inside the dialog with the next step. |
| `scroll` | dialogs with long content | Body scrolls, header and footer stay. |
| `mobile` | every dialog (covered by responsiveness, not a separate file) | Full-width bottom sheet under 640px. Check it in the screenshot sweep. |

### Notifications

| State | Required | Shows |
|---|---|---|
| `info` | always | Neutral information. |
| `success` | always | Something completed. Include an undo action when the action is reversible. |
| `warning` | always | Something needs attention but nothing broke. |
| `danger` | always | Something failed. Says what and what to do; never auto-dismisses. |
| `with-action` | notifications that carry an action | Primary action inside the notification (Undo, View, Retry). |
| `stacked` | toasts | Three toasts at once; order, spacing and dismissal are visible. |
| `persistent` | banners | Stays until dismissed (maintenance, trial ending, verify e-mail). |
| `unread` / `read` / `empty` | notification center page (that page is a `page`, not a notification) | Unread badge count, read styling, nothing-yet state. |

Theme (light and dark), viewport (360, 768, 1280) and keyboard focus are not
separate files: every mock is responsive and themed through tokens, and the
screenshot sweep covers them.

## 3. Per-component states inside a mock

A mock shows the page in **one** state, but it should still demonstrate the
interactive states of its components where that helps a reviewer: force a
state statically with `data-state="hover|focus|active|disabled|loading|selected|invalid"`
on the element (the UI kit styles both the real pseudo-class and the attribute).
Use this sparingly in page mocks (one example per component type is enough);
the design system documents the full matrix.

## 4. Counting

Before writing, count the files: screens × states. A mid-sized product lands at
roughly 15–30 pages, 10–20 dialogs and 5–10 notification types, giving
120–250 files. That is the job. If it is bigger than it looked, do it and say
what it cost rather than quietly narrowing scope.
