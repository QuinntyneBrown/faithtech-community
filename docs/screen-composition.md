# Screen composition

Which `@faithtech-community/components` parts build each screen, and what is built locally in the feature library. Sources: the mocks in `docs/mocks/` (states listed per screen) and the public API of `frontend/projects/components/src/public-api.ts`. Mock-only chrome (`mock-bar`, `mock-note`) is excluded.

**Local UI** is markup a feature library writes itself. It is limited to page composition: headings that belong to the page, sections and the glue between `api` services and components. Anything reusable goes into `components` first (`AGENTS.md`).

Coverage: the profiles screens (`profile`, `edit-profile`, `delete-photo`), the admin screens (`admin-users`, `audit-log`, `add-role`, `remove-role`, `suspend-user`), the invites screens (`invites`, `accept-invite`, `send-invite`), the team list (`team`), the contacts screens (`contacts`, `contact`, `contact-form`, `archived-contacts`, `add-note`, `archive-contact`, `delete-contact`, `link-contact`) and the partners screens (`partners`, `partner`, `partner-form`, `add-partner`, `move-partner`). Other screens are added here as their features are built.

## Shell

| Part | Library | Local |
|---|---|---|
| App shell around `/people/**`, `/team`, `/admin/**`, `/invites`, `/contacts/**`, `/partners/**` | `TopBarComponent` with the account menu (`MenuComponent` "Account menu for {name}" whose face is an `AvatarComponent`: *Your profile* → `/people/me`, *Settings* → `/settings`, *Sign out*), `NavDrawerComponent`, `TabBarComponent`, `SkipLinkComponent`, `ToastRegionComponent` (in `AppShellComponent`). System Admins get an **Admin** link (secondary) to `/admin`. | — |

## Pages

### Profile — `/people/:id`, `/people/me` (`pages/profile`: default, own, loading, empty, error, not-found)

- Library: `ProfileHeaderComponent` (featured photo via `StickerComponent` or initials via `AvatarComponent`, name as the `h1`, `BadgeComponent` roles, home city, bio, photo strip of `PhotoComponent`), `ButtonComponent` (*Edit profile*, *Add photos*, *Try again*, *Go home*), `EmptyStateComponent` (no photos on the own profile; error variant for load failure; not-found).
- Loading uses `ProfileHeaderComponent [loading]` (skeletons, `aria-busy`).
- Own state adds *Edit profile* in the header's `[actions]` slot.
- *Add a role* and *Remove a role* (`ButtonComponent` in the `[actions]` slot) appear when `assignableRoles` from `api` offers an option for the caller (City Lead or System Admin, L2-009); each opens `RoleDialogComponent` through `DialogService` (ADR 0005) and the role badges update from the API's answer.
- Local: none beyond composition. The `h1` for the error and not-found states is a visually hidden page heading.

### Edit profile — `/people/me/edit` (`pages/edit-profile`: default, loading, error, invalid, busy, success, uploading, too-large, pending, full)

- Library: `BreadcrumbComponent` + `BreadcrumbItemComponent`, `PageHeaderComponent`, `CardComponent` (About you, Photos), `StackComponent`, `FormFieldComponent` + `TextFieldComponent` (Name, Home city), `FormFieldComponent` + `TextareaComponent` (Bio), `PictureListComponent` (photos, descriptions, Feature, Remove, Add photos, uploading, failed, pending and full states), `ErrorSummaryComponent` (invalid), `FormActionsComponent` + `ButtonComponent` (*Save profile* with `loading`, *Cancel*), `SkeletonComponent` (loading), `EmptyStateComponent` error variant (error), `ToastService` (success: "Profile saved").
- Opens `DeletePhotoDialog` through `DialogService` from a saved photo's Remove.
- Local: the `<form>` element and the section headings.

### Admin users — `/admin/users` (`pages/admin-users`: default, loading, error, no-results, forbidden)

- Library: `PageHeaderComponent` ("Admin"), `TabsComponent` + `TabComponent` in navigation mode (Users, Audit log, Roles → `/people`), `TextFieldComponent` `type="search"` labelled "Search users", `TableComponent` (cell templates: `AvatarComponent` + `LinkComponent` to the profile; `BadgeComponent` `role` per role or "No role"; `BadgeComponent` status — Active `success`, Suspended `danger`, Unverified `warning`; ghost `ButtonComponent` *Suspend {name}* or *Reinstate {name}*), `ListSkeletonComponent` (loading), `EmptyStateComponent` (no-results with *Clear search*; error variant with *Try again*; forbidden with *Back to home*), `ButtonComponent` *Show more users* when more than 25.
- Opens `SuspendUserDialog` through `DialogService`.
- Local: the search `<form role="search">`. The mock's workspace-owner alert belongs to the Agile design and is not built.

### Audit log — `/admin/audit-log` (`pages/audit-log`: default, loading, empty, error, no-results)

- Library: `PageHeaderComponent` with *Export CSV* (`ButtonComponent`, `IconComponent` `export`), `TabsComponent` + `TabComponent`, `FormFieldComponent` + `SelectComponent` "Action" (all, role changes, suspensions, private contact access, deletions), `TableComponent` (When monospaced, Who, What; `loading` shows skeleton rows under the headers), `EmptyStateComponent` (empty; no-results "No {category} in the last 90 days" with *Show all actions*; error; forbidden as on admin users), `ButtonComponent` *Show older entries* when more than 50.
- Local: the CSV download glue (object URL and a temporary link).

### Invites — `/invites` (`pages/invites`: default, loading, empty, error)

- Library: `BreadcrumbComponent` + `BreadcrumbItemComponent` (People and roles → Invites), `PageHeaderComponent` with *Invite someone*, `CardComponent` `flush` + `ListComponent` + `ListItemComponent` (email, "{role} · Sent {day} · expires {day}" meta, trailing `BadgeComponent` — Pending `info`, Accepted `success`, Expired `warning`, Withdrawn `neutral` — and a ghost *Resend* on expired invites), `ListSkeletonComponent` (3 rows), `EmptyStateComponent` (empty with *Invite someone*; error with *Try again*), `ToastService` ("Invite sent to {email}", "Invite sent again").
- Opens `SendInviteDialog` through `DialogService`.
- Local: none beyond composition.

### Accept invite — `/accept-invite/:token` (`pages/accept-invite`: default, invalid, error, existing, sign-in, wrong-account)

- Library: `AuthLayoutComponent`, `CardComponent`, `StackComponent`, `ClusterComponent` + `AvatarComponent` + `BadgeComponent` `role` (the invitation line), `AlertComponent` (error summary "Fix N things to accept the invite"; unreachable), `FormFieldComponent` + `TextFieldComponent` (Full name; Email read-only with help; Create a password with `reveal`), `FormErrorFocusDirective`, `ButtonComponent` (*Accept and join*, *Accept invite*, *Sign in to accept*, *Create an account*, *Go home*), `EmptyStateComponent` error variant with `headingLevel` 1 (expired, used, withdrawn, unknown link, wrong account), `SkeletonComponent` while the token is checked.
- Local: the `<form>` element and the `h1` "You’re invited".

### Team — `/team` (`pages/team`: default, member, loading, empty, no-results, error)

- Library: `PageHeaderComponent` ("Team", "Everyone with a lead or volunteer role") with *Invite someone* (`ButtonComponent` `primary` link to `/invites`, leads and System Admins only; `member` hides it), `ClusterComponent` of `ChipComponent` toggles (All, Leads, Volunteers; one pressed) and `FormFieldComponent` + `SelectComponent` (City: All cities and every team member's home city), `CardComponent` `flush` + `ListComponent` + `ListItemComponent` (name linking to `/people/:id`, leading `AvatarComponent` `sm` with the featured photo through `src`, `[meta]` slot holding a `BadgeComponent` `role` per role), `ListSkeletonComponent` (5 rows), `EmptyStateComponent` (empty with *Invite someone* for leads; no-results "No {volunteers|leads|team members} in {city} yet" with *Show everyone*; error with *Try again*).
- Local: none beyond composition.

### Contacts — `/contacts` (`pages/contacts`: default, loading, empty, error, no-results, forbidden)

- Library: `PageHeaderComponent` ("Private to you · {n} contacts") with ghost *Archived* and primary *Add contact* (`ButtonComponent` `href`, `IconComponent` `archive`, `add`), `AlertComponent` info ("{name} just joined FaithTech" with *Review*), `TextFieldComponent` `type="search"` labelled "Search contacts", `CardComponent` `flush` + `ListComponent` + `ListItemComponent` (link to the contact, "{organisation} · {city}" meta, leading `AvatarComponent`, trailing `BadgeComponent` — Private `neutral` with `locked` icon, Signed up `success`, Member `info`), `ListSkeletonComponent`, `EmptyStateComponent` (empty with *Add your first contact*; no-results "No contacts match “{term}”" with *View archived contacts*; error with *Try again*; forbidden "Contacts are private to each lead" with *Back to home*).
- The list is cards at every width; there is no table (ADR 0009).
- Local: the search `<form role="search">`; the visually hidden `h1` of the forbidden state.

### Contact — `/contacts/:id` (`pages/contact`: default, loading, error, match, linked)

- Library: `BreadcrumbComponent`, `PageHeaderComponent` (subtitle "Private contact · only you can see this", "Member · linked profile" or, for a System Admin, "Another lead’s private contact · your access is recorded") with *Edit* (`href`) and ghost *Archive*, `AlertComponent` (match "{name} has joined FaithTech" with *Link to their profile* and *Not them*; linked success), `SplitComponent`, `CardComponent` (notes; Details), `BadgeComponent` Private, `ButtonComponent` *Add note*, `NoteComponent` with `formatDay`, `DescriptionListComponent` + `DescriptionListItemComponent` (Email, Phone, Organisation, City), `PhotoComponent` (the linked member's featured photo), `LinkComponent` *View their profile*, `SkeletonComponent`, `EmptyStateComponent` (not found, error).
- Opens `AddNoteDialog`, `ArchiveContactDialog` and `LinkContactDialog` through `DialogService`; archiving returns to `/contacts` with a `ToastService` success toast.
- Local: the notes section heading.

### Add / edit contact — `/contacts/new`, `/contacts/:id/edit` (`pages/contact-form`: default, edit, invalid, duplicate, busy, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent`, `CardComponent`, `StackComponent`, `ErrorSummaryComponent` ("Fix N things to save"), `FormErrorFocusDirective`, `AlertComponent` (duplicate "{name} is already a member"; error), `FormFieldComponent` + `TextFieldComponent` (Name, Email with help, Phone, Organisation, City), `TextareaComponent` (First note, create only), `FormActionsComponent` + `ButtonComponent` (*Save contact* or *Save and link*, *Cancel*), `SkeletonComponent`, `EmptyStateComponent` error.
- Local: the `<form>` element.

### Archived contacts — `/contacts/archived` (`pages/archived-contacts`: default, loading, empty, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent`, `CardComponent` `flush` + `ListComponent` + `ListItemComponent` ("Archived {day} · {city}" meta, leading `AvatarComponent`, trailing `ClusterComponent` with *Restore {name}* and ghost *Delete {name} permanently*), `ListSkeletonComponent`, `EmptyStateComponent` (Nothing archived with *Back to contacts*; error; forbidden), `ToastService` ("Contact restored", "Contact deleted").
- Opens `DeleteContactDialog` through `DialogService`.
- Local: none beyond composition.

### Partners — `/partners` (`pages/partners`: default, loading, empty, error, read-only, dragging, tabs)

- Library: `PageHeaderComponent` ("Shared by every lead · {n} partners") with *Add partner* for lead roles and System Admin, `AlertComponent` info "Read-only for Staff", `KanbanBoardComponent` (label "Partner pipeline", polite `announcement` after each move) + `KanbanColumnComponent` (Lead, In funnel, Confirmed with counts; `cardDropped`) + `KanbanCardComponent` (link, "{contact} · {offering}" caption, *Move* when the caller can edit), `TabsComponent` + `TabComponent` (below 640px: "Lead (n)" tabs, one column at a time), `CardComponent` + `SkeletonComponent` (loading), `EmptyStateComponent` (Start your partner pipeline; error; forbidden "The partner pipeline is for leads"), `ToastService`.
- Opens `AddPartnerDialog` and `MovePartnerDialog` through `DialogService`.
- Local: the column template rendered in both layouts (declared inside the board so the columns share its drop-list group).

### Partner — `/partners/:id` (`pages/partner`: default, loading, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent` with the `ftPageHeaderSubtitle` slot (`BadgeComponent` stage — Lead `neutral`, In funnel `warning`, Confirmed `success` — and the offering), *Move stage* and ghost *Edit* for lead roles and System Admin, `SplitComponent`, `CardComponent` (Stage history; Details), `FeedComponent` + `FeedItemComponent` ("{who} moved {partner} from {stage} to {stage}: “{note}”", `formatDay`), `DescriptionListComponent` (Contact, Email, Phone, Website, Offering, Owner, Notes), `SkeletonComponent`, `EmptyStateComponent` (not found, error).
- Opens `MovePartnerDialog` through `DialogService`.
- Local: none beyond composition.

### Edit partner — `/partners/:id/edit` (`pages/partner-form`: default, loading, invalid, busy, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent`, `CardComponent`, `StackComponent`, `ErrorSummaryComponent`, `FormErrorFocusDirective`, `AlertComponent` (error), `FormFieldComponent` + `TextFieldComponent` (Organisation, Website, What they could offer, Main contact, Email, Phone), `SelectComponent` (Owner: "No owner" and the members with a lead role), `TextareaComponent` (Notes), `FormActionsComponent` + `ButtonComponent` (*Save partner*, *Cancel*), `SkeletonComponent`, `EmptyStateComponent` (error; read-only for Staff).
- Local: the `<form>` element.

## Dialogs

| Dialog (mock: states) | Surface | Library | Local |
|---|---|---|---|
| Delete photo (`dialogs/delete-photo`: default, busy, failed) | `DialogService` (CDK Dialog) | `DialogComponent` (`tone="danger"`, `icon="delete"`, `busy`), `PhotoComponent` (the photo being deleted), `AlertComponent` (failed), `ButtonComponent` (*Cancel*, *Delete photo* `variant="danger"` with `loading`) | — |
| Add role, Remove role (`dialogs/add-role`: default, invalid, busy, failed; `dialogs/remove-role`: default, busy, failed) | `DialogService` | `RoleDialogComponent` (one component, `mode` add or remove, ADR 0005): `DialogComponent`, `RadioGroupComponent` + `RadioComponent` with role descriptions, `AlertComponent` (failed; refusal such as the last System Admin), `ButtonComponent` (*Cancel*, *Add role* primary or *Remove role* danger, with `loading`) | — (opened from the profile page with a `submit` that calls `ROLES_SERVICE`) |
| Suspend user (`dialogs/suspend-user`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`tone="danger"`, `icon="suspended"`), `FormFieldComponent` + `TextareaComponent` (reason), `AlertComponent`, `ButtonComponent` (*Cancel*, *Suspend* danger) | — (`SuspendUserDialog` in `admin`) |
| Send invite (`dialogs/send-invite`: default, invalid, busy, failed, limited) | `DialogService` | `DialogComponent` (`icon="invite"`), `FormFieldComponent` + `TextFieldComponent` (Email), `SelectComponent` (Join with role: only `assignableRoles`, hidden when none), `TextareaComponent` (Personal note, optional), `AlertComponent` (failed; limited: "You can’t send this invite" with the server's message), `ButtonComponent` | The `<form>` element (`SendInviteDialog` in `invites`) |
| Add note (`dialogs/add-note`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`icon="edit"`), `FormFieldComponent` + `TextareaComponent` (Note, 1–2,000 characters), `AlertComponent` (failed), `ButtonComponent` (*Cancel*, *Add note*) | The `<form>` element (`AddNoteDialog` in `contacts`) |
| Archive contact (`dialogs/archive-contact`: default, busy, failed) | `DialogService` | `DialogComponent` (`icon="archive"`), `AlertComponent`, `ButtonComponent` (*Cancel*, *Archive*) | — (`ArchiveContactDialog` in `contacts`) |
| Delete contact permanently (`dialogs/delete-contact`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`tone="danger"`, `icon="delete"`), `FormFieldComponent` + `TextFieldComponent` ("Type DELETE to confirm", error after leaving the field), `AlertComponent`, `ButtonComponent` (*Cancel*, *Delete permanently* `danger`, disabled until the text is exactly DELETE) | The `<form>` element (`DeleteContactDialog` in `contacts`) |
| Link contact to profile (`dialogs/link-contact`: default, busy, failed) | `DialogService` | `DialogComponent` (`icon="link"`), `ClusterComponent` + `AvatarComponent` (the member), `RadioGroupComponent` + `RadioComponent` (keep or discard the notes), `AlertComponent`, `ButtonComponent` (*Cancel*, *Link profile*) | — (`LinkContactDialog` in `contacts`) |
| Add partner (`dialogs/add-partner`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`icon="partners"`), `FormFieldComponent` + `TextFieldComponent` (Organisation, Website, Main contact, Email, Phone), `SelectComponent` (Stage, Lead by default; Owner), `TextareaComponent` (What they could offer, Notes), `AlertComponent`, `ButtonComponent` | The `<form>` element (`AddPartnerDialog` in `partners`) |
| Move partner (`dialogs/move-partner`: default, busy, failed) | `DialogService` | `DialogComponent` (`icon="move"`), `RadioGroupComponent` + `RadioComponent` (the three stages, the current one marked "Current stage"), `FormFieldComponent` + `TextareaComponent` (Note for the history), `AlertComponent`, `ButtonComponent` (*Cancel*, *Move to {stage}*, disabled for the current stage) | The `<form>` element (`MovePartnerDialog` in `partners`) |

## Notifications

None for profiles. Admin and invites use `ToastService` success toasts on the invites page; role changes and accepted invites raise in-app notifications that the notifications feature will show. Contacts and partners use `ToastService` toasts (archived, restored, deleted, partner added, a failed drag); a contact who verifies their email raises a `ContactSignedUp` in-app notification and an email to the owning lead.

## Summary of local UI to build

1. Admin and invites added to the library rather than building locally: `RoleDialogComponent` (shared by `profiles` and later `admin` screens, ADR 0005), `ListSkeletonComponent` (loading lists and tables), `EmptyStateComponent` `headingLevel` 1 (full-page errors on the accept-invite page), `TableComponent` now contains its visually hidden headers so tables scroll inside their frame on phones, and `formatDay` / `formatTimestamp` give the mocks' date formats from the browser's `Intl` (keeping Angular's locale data out of the initial bundle).
2. Team added to the library: `AvatarComponent` `src` shows a member's featured photo over the initials (ADR 0007), and `ListItemComponent` gained a `[meta]` slot for the role-badge meta line (`components/list.html`).
3. Nothing reusable: every profiles screen is composed from the library. `PictureListComponent` gained a per-photo `pending` flag for photos chosen but not saved yet (design system: `components/picture-list.html`).
4. Contacts and partners added to the library rather than building locally: `PageHeaderComponent` gained an `ftPageHeaderSubtitle` slot for rich subtitles such as the partner's stage badge. Everything else is composed from existing components; the add-partner dialog and the partner form share their field rules in the feature's `partner-fields.ts`.
