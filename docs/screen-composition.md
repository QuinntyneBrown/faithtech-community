# Screen composition

Which `@faithtech-community/components` parts build each screen, and what is built locally in the feature library. Sources: the mocks in `docs/mocks/` (states listed per screen) and the public API of `frontend/projects/components/src/public-api.ts`. Mock-only chrome (`mock-bar`, `mock-note`) is excluded.

**Local UI** is markup a feature library writes itself. It is limited to page composition: headings that belong to the page, sections and the glue between `api` services and components. Anything reusable goes into `components` first (`AGENTS.md`).

Coverage: the profiles screens (`profile`, `edit-profile`, `delete-photo`), the admin screens (`admin-users`, `audit-log`, `add-role`, `remove-role`, `suspend-user`) the invites screens (`invites`, `accept-invite`, `send-invite`) and the team list (`team`). Other screens are added here as their features are built.

## Shell

| Part | Library | Local |
|---|---|---|
| App shell around `/people/**`, `/team`, `/admin/**`, `/invites` | `TopBarComponent` with the account menu (`MenuComponent` "Account menu for {name}" whose face is an `AvatarComponent`: *Your profile* → `/people/me`, *Settings* → `/settings`, *Sign out*), `NavDrawerComponent`, `TabBarComponent` (top bar, tab bar and menu all from `shell/navigation.ts`, one rule by role, ADR 0009), `SkipLinkComponent`, `ToastRegionComponent` (in `AppShellComponent`). System Admins get an **Admin** link (secondary) to `/admin`. | — |

## Pages

### Profile — `/people/:id`, `/people/me` (`pages/profile`: default, own, loading, empty, error, not-found)

- Library: `ProfileHeaderComponent` (featured photo, or initials without one, in an XL `AvatarComponent`, name as the `h1`, `BadgeComponent` roles, home city, bio, photo strip of `PhotoComponent`), `ButtonComponent` (*Edit profile*, *Add photos*, *Try again*, *Go home*), `EmptyStateComponent` (no photos on the own profile; error variant for load failure; not-found).
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

### Audit log — `/admin/audit-log` (`pages/audit-log`: default, loading, empty, error, no-results, exporting, exported, export-failed)

- Library: `PageHeaderComponent` with *Export CSV* (`ButtonComponent` with `loading` while exporting, `IconComponent` `export`; `ToastService` "Audit log exported" or a danger toast with *Try again*), `TabsComponent` + `TabComponent`, `FormFieldComponent` + `SelectComponent` "Action" (all, role changes, suspensions, private contact access, deletions), `TableComponent` (When monospaced, Who, What; `loading` shows skeleton rows under the headers), `EmptyStateComponent` (empty; no-results "No {category} in the last 90 days" with *Show all actions*; error; forbidden as on admin users), `ButtonComponent` *Show older entries* when more than 50.
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

## Dialogs

| Dialog (mock: states) | Surface | Library | Local |
|---|---|---|---|
| Delete photo (`dialogs/delete-photo`: default, busy, failed) | `DialogService` (CDK Dialog) | `DialogComponent` (`tone="danger"`, `icon="delete"`, `busy`), `PhotoComponent` (the photo being deleted), `AlertComponent` (failed), `ButtonComponent` (*Cancel*, *Delete photo* `variant="danger"` with `loading`) | — |
| Add role, Remove role (`dialogs/add-role`: default, invalid, busy, failed; `dialogs/remove-role`: default, busy, failed) | `DialogService` | `RoleDialogComponent` (one component, `mode` add or remove, ADR 0005): `DialogComponent`, `RadioGroupComponent` + `RadioComponent` with role descriptions, `AlertComponent` (failed; refusal such as the last System Admin), `ButtonComponent` (*Cancel*, *Add role* primary or *Remove role* danger, with `loading`) | — (opened from the profile page with a `submit` that calls `ROLES_SERVICE`) |
| Suspend user (`dialogs/suspend-user`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`tone="danger"`, `icon="suspended"`), `FormFieldComponent` + `TextareaComponent` (reason), `AlertComponent`, `ButtonComponent` (*Cancel*, *Suspend* danger) | — (`SuspendUserDialog` in `admin`) |
| Send invite (`dialogs/send-invite`: default, invalid, busy, failed, limited) | `DialogService` | `DialogComponent` (`icon="invite"`), `FormFieldComponent` + `TextFieldComponent` (Email), `SelectComponent` (Join with role: only `assignableRoles`, hidden when none), `TextareaComponent` (Personal note, optional), `AlertComponent` (failed; limited: "You can’t send this invite" with the server's message), `ButtonComponent` | The `<form>` element (`SendInviteDialog` in `invites`) |

## Notifications

None for profiles. Admin and invites use `ToastService` success toasts on the invites page; role changes and accepted invites raise in-app notifications that the notifications feature will show.

## Summary of local UI to build

1. Admin and invites added to the library rather than building locally: `RoleDialogComponent` (shared by `profiles` and later `admin` screens, ADR 0005), `ListSkeletonComponent` (loading lists and tables), `EmptyStateComponent` `headingLevel` 1 (full-page errors on the accept-invite page), `TableComponent` now contains its visually hidden headers so tables scroll inside their frame on phones, and `formatDay` / `formatTimestamp` give the mocks' date formats from the browser's `Intl` (keeping Angular's locale data out of the initial bundle).
2. Team added to the library: `AvatarComponent` `src` shows a member's featured photo over the initials (ADR 0007), and `ListItemComponent` gained a `[meta]` slot for the role-badge meta line (`components/list.html`).
3. Nothing reusable: every profiles screen is composed from the library. `PictureListComponent` gained a per-photo `pending` flag for photos chosen but not saved yet (design system: `components/picture-list.html`).
