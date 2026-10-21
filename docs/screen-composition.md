# Screen composition

Which `@faithtech-community/components` parts build each screen, and what is built locally in the feature library. Sources: the mocks in `docs/mocks/` (states listed per screen) and the public API of `frontend/projects/components/src/public-api.ts`. Mock-only chrome (`mock-bar`, `mock-note`) is excluded.

**Local UI** is markup a feature library writes itself. It is limited to page composition: headings that belong to the page, sections and the glue between `api` services and components. Anything reusable goes into `components` first (`AGENTS.md`).

Coverage: the profiles screens (`profile`, `edit-profile`, `delete-photo`), the admin screens (`admin-users`, `audit-log`, `add-role`, `remove-role`, `suspend-user`), the invites screens (`invites`, `accept-invite`, `send-invite`), the team list (`team`) and the agile screens (`workspaces`, `team-board`, `backlog`, `work-item`, `workspace-settings`, `planning-poker` and their dialogs). Other screens are added here as their features are built.

## Shell

| Part | Library | Local |
|---|---|---|
| App shell around `/people/**`, `/team`, `/admin/**`, `/invites`, `/workspaces/**` | `TopBarComponent` with the account menu (`MenuComponent` "Account menu for {name}" whose face is an `AvatarComponent`: *Your profile* → `/people/me`, *Settings* → `/settings`, *Sign out*), `NavDrawerComponent`, `TabBarComponent` (top bar, tab bar and menu all from `shell/navigation.ts`, one rule by role, ADR 0009), `SkipLinkComponent`, `ToastRegionComponent` (in `AppShellComponent`). System Admins get an **Admin** link (secondary) to `/admin`. | — |

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

- Library: `PageHeaderComponent` ("Admin"), `TabsComponent` + `TabComponent` in navigation mode (Users, Audit log), `TextFieldComponent` `type="search"` labelled "Search users", `TableComponent` (cell templates: `AvatarComponent` + `LinkComponent` to the profile; `BadgeComponent` `role` per role or "No role"; `BadgeComponent` status — Active `success`, Suspended `danger`, Unverified `warning`; ghost `ButtonComponent` *Suspend {name}* or *Reinstate {name}*), `ListSkeletonComponent` (loading), `EmptyStateComponent` (no-results with *Clear search*; error variant with *Try again*; forbidden with *Back to home*), `ButtonComponent` *Show more users* when more than 25.
- Opens `SuspendUserDialog` through `DialogService`.
- `AlertComponent` `warning` "A workspace needs a new owner" for each live workspace whose owner lost City Lead (from `AGILE_SERVICE.listWorkspaces`), with *Open workspace settings* (`ButtonComponent` link) in `ftAlertActions` (L2-037 AC2).
- Local: the search `<form role="search">`.

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

### Workspaces — `/workspaces` (`pages/workspaces`: default, member, staff, empty, empty-member, loading, error, archived)

- Library: `PageHeaderComponent` with *New workspace* (City Lead, System Admin), `AlertComponent` (Read-only for Staff), `CardComponent` `flush` + `ListComponent` + `ListItemComponent` (`StickerComponent` leading, "Owner: … · Scrum · Sprint 7 active · 5 members" meta, `BadgeComponent` *Owner*), a second card *Archived* with *Restore* (`ButtonComponent`, `IconComponent` `restore`), `ListSkeletonComponent`, `EmptyStateComponent` (empty for leads and for members; error).
- Opens `CreateWorkspaceDialog`.
- Local: none beyond composition.

### Workspace frame — shared by board, backlog, Planning Poker and settings

- Library: `BreadcrumbComponent`, `PageHeaderComponent` (workspace name as the `h1`, subtitle, `ftWorkspaceActions` slot), `TabsComponent` + `TabComponent` (Board, Backlog, Planning Poker, Settings for the owner and System Admin), `AlertComponent` (Read-only for Staff, except on Planning Poker), `EmptyStateComponent` ("You’re not a member of this workspace").
- Local: `WorkspaceFrameComponent` in `agile`, which only composes these.

### Board — `/workspaces/:id` (`pages/team-board`: default, kanban, member, staff, empty, loading, error, phone)

- Library: `KanbanBoardComponent` + `KanbanColumnComponent` + `KanbanCardComponent` (`kind`, `kindVariant`, `moveTarget`; phone column tabs), `StatComponent` (sprint points), `FormFieldComponent` + `SelectComponent` (initiative or epic filter), `SkeletonComponent`, `AlertComponent`, `EmptyStateComponent`, `ButtonComponent` (*New story*, *Close sprint*).
- Opens `MoveCardDialog` (keyboard and phone move), `WorkItemDialog`, `CloseSprintDialog`. Live moves arrive through `AGILE_LIVE_SERVICE`.
- Local: the visually hidden live-region announcement.

### Backlog — `/workspaces/:id/backlog` (`pages/backlog`: default, member, staff, kanban, empty, no-results, loading, error, history)

- Library: `TreeComponent` + `TreeItemComponent` (toggle-button disclosure), `ChipComponent` (Tree, Sprint history), `CardComponent` (sprint card), `TableComponent` (history), `FormFieldComponent` + `SelectComponent` (filter), `BadgeComponent` (kind), `ListSkeletonComponent`, `EmptyStateComponent`, `ClusterComponent`, `IconComponent`, `ButtonComponent` (*New item*, *Start sprint*).
- Opens `WorkItemDialog`, `StartSprintDialog`, `CloseSprintDialog`.
- Local: the four explicit tree levels (content queries cannot see recursive templates).

### Work item — `/workspaces/:id/items/:itemId` (`pages/work-item`: default, member, staff, empty, not-in-sprint, loading, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent` with *Edit* and, for the owner and System Admin, *Archive*, `SplitComponent`, `CardComponent` (Description, Details), `DescriptionListComponent`, `CheckboxGroupComponent` + `CheckboxComponent` (tasks), `FormFieldComponent` + `TextFieldComponent` / `TextareaComponent` / `SelectComponent` (new task, comment, status), `FeedComponent` + `FeedItemComponent` (comments), `BadgeComponent`, `AlertComponent`, `EmptyStateComponent`, `SkeletonComponent`.
- Opens `WorkItemDialog` (edit, add task) and `ArchiveWorkItemDialog`.
- Local: the task and comment `<form>` elements, as the mock shows them inline.

### Workspace settings — `/workspaces/:id/settings` (`pages/workspace-settings`: default, invalid, forbidden, loading, error, needs-owner)

- Library: `CardComponent` (Workspace, Members, Archived items), `FormFieldComponent` + `TextFieldComponent` (Name), `ErrorSummaryComponent`, `DescriptionListComponent` (Method with *Switch to …*), `ListComponent` + `ListItemComponent` (`AvatarComponent`, *Remove*; archived items with a kind `BadgeComponent` and *Restore*), `DangerZoneComponent` (*Archive workspace*), `AlertComponent` (save failed; "This workspace needs a new owner" with *Reassign owner* for System Admin), `EmptyStateComponent` ("Only the owner changes settings").
- Opens `AddWorkspaceMembersDialog`, `RemoveWorkspaceMemberDialog`, `SwitchMethodDialog`, `ArchiveWorkspaceDialog`, `ReassignOwnerDialog`.
- Local: the rename `<form>`.

### Planning Poker — `/workspaces/:id/poker` (`pages/planning-poker`: default, facilitator, revealed, agreed, staff, empty, forbidden, loading, error)

- Library: `SplitComponent`, `CardComponent` (current story, *You’re the facilitator*, *Your vote*, *Votes (n invited)*), `BadgeComponent` (Story), `AlertComponent` (who has voted; votes differ; agreed points; watching as Staff), `EstimatePickerComponent` (Your vote), `EstimateCardComponent` + `AvatarComponent` in `ListComponent` (votes), `FormFieldComponent` + `SelectComponent` (Final points), `ButtonComponent` (*Reveal votes*, *End session*, *Set points*, *Re-vote*, *Start a session*), `EmptyStateComponent`, `ListSkeletonComponent`.
- Opens `StartPokerDialog`. Changes arrive through `AGILE_LIVE_SERVICE.watchPokerSession` and the page re-reads the session (ADR 0009).
- Local: the "Now estimating" overline and story heading.

## Dialogs

| Dialog (mock: states) | Surface | Library | Local |
|---|---|---|---|
| Delete photo (`dialogs/delete-photo`: default, busy, failed) | `DialogService` (CDK Dialog) | `DialogComponent` (`tone="danger"`, `icon="delete"`, `busy`), `PhotoComponent` (the photo being deleted), `AlertComponent` (failed), `ButtonComponent` (*Cancel*, *Delete photo* `variant="danger"` with `loading`) | — |
| Add role, Remove role (`dialogs/add-role`: default, invalid, busy, failed; `dialogs/remove-role`: default, busy, failed) | `DialogService` | `RoleDialogComponent` (one component, `mode` add or remove, ADR 0005): `DialogComponent`, `RadioGroupComponent` + `RadioComponent` with role descriptions, `AlertComponent` (failed; refusal such as the last System Admin), `ButtonComponent` (*Cancel*, *Add role* primary or *Remove role* danger, with `loading`) | — (opened from the profile page with a `submit` that calls `ROLES_SERVICE`) |
| Suspend user (`dialogs/suspend-user`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`tone="danger"`, `icon="suspended"`), `FormFieldComponent` + `TextareaComponent` (reason), `AlertComponent`, `ButtonComponent` (*Cancel*, *Suspend* danger) | — (`SuspendUserDialog` in `admin`) |
| Send invite (`dialogs/send-invite`: default, invalid, busy, failed, limited) | `DialogService` | `DialogComponent` (`icon="invite"`), `FormFieldComponent` + `TextFieldComponent` (Email), `SelectComponent` (Join with role: only `assignableRoles`, hidden when none), `TextareaComponent` (Personal note, optional), `AlertComponent` (failed; limited: "You can’t send this invite" with the server's message), `ButtonComponent` | The `<form>` element (`SendInviteDialog` in `invites`) |
| Create workspace (`dialogs/create-workspace`: default, invalid, busy, failed) | `DialogService` | `DialogComponent`, `FormFieldComponent` + `TextFieldComponent` (Name), `RadioGroupComponent` + `RadioComponent` (Scrum, Kanban), `CheckboxGroupComponent` + `CheckboxComponent` (members), `AlertComponent`, `ButtonComponent` | — (`agile`) |
| Add members, Remove member (`dialogs/add-workspace-members`, `dialogs/remove-workspace-member`) | `DialogService` | `DialogComponent`, `CheckboxGroupComponent` (candidates), `AlertComponent`, `ButtonComponent` (danger for remove) | — |
| New and edit work item (`dialogs/new-work-item`: default, invalid, busy, failed, edit) | `DialogService` | `DialogComponent`, `RadioGroupComponent` (kind), `FormFieldComponent` + `TextFieldComponent` / `TextareaComponent` / `SelectComponent` (parent, assignee, points, status), `FormErrorFocusDirective`, `AlertComponent`, `ButtonComponent` | — |
| Move card (`dialogs/move-card`: default, busy, failed) | `DialogService` | `DialogComponent`, `RadioGroupComponent` (To Do, In Progress, Done), `AlertComponent`, `ButtonComponent` | — |
| Start sprint (`dialogs/start-sprint`) | `DialogService` | `DialogComponent`, `GridComponent`, `FormFieldComponent` + `TextFieldComponent` (name, goal, dates), `CheckboxGroupComponent` (stories), `FormErrorFocusDirective`, `AlertComponent`, `ButtonComponent` | — |
| Close sprint (`dialogs/close-sprint`) | `DialogService` | `DialogComponent`, `CardComponent` + `ListComponent` + `ListItemComponent` (unfinished stories with a status `BadgeComponent`), `AlertComponent`, `ButtonComponent` | — |
| Switch method (`dialogs/switch-method`: default, to-scrum, busy, failed) | `DialogService` | `DialogComponent` (`icon="settings"`), `RadioGroupComponent`, `AlertComponent`, `ButtonComponent` | — |
| Archive workspace, Archive work item (`dialogs/archive-workspace`, `dialogs/archive-work-item`: default, busy, failed) | `DialogService` | `DialogComponent` (`tone="danger"`, `icon="archive"`), `AlertComponent`, `ButtonComponent` (danger) | — |
| Reassign owner (`dialogs/reassign-owner`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`icon="admin"`), `FormFieldComponent` + `SelectComponent` (City Leads only), `FormErrorFocusDirective`, `AlertComponent`, `ButtonComponent` | — |
| Start Planning Poker (`dialogs/start-poker`: default, invalid, busy, failed) | `DialogService` | `DialogComponent`, `CheckboxGroupComponent` + `CheckboxComponent` (stories, members), `FormErrorFocusDirective`, `AlertComponent`, `ButtonComponent` | — |

## Notifications

None for profiles. Admin and invites use `ToastService` success toasts on the invites page; role changes and accepted invites raise in-app notifications that the notifications feature will show. Agile screens use `ToastService` toasts for saves, moves, archive and restore; member additions, assignments, Planning Poker invites and an owner losing City Lead raise in-app notifications and emails.

## Summary of local UI to build

1. Admin and invites added to the library rather than building locally: `RoleDialogComponent` (shared by `profiles` and later `admin` screens, ADR 0005), `ListSkeletonComponent` (loading lists and tables), `EmptyStateComponent` `headingLevel` 1 (full-page errors on the accept-invite page), `TableComponent` now contains its visually hidden headers so tables scroll inside their frame on phones, and `formatDay` / `formatTimestamp` give the mocks' date formats from the browser's `Intl` (keeping Angular's locale data out of the initial bundle).
2. Team added to the library: `AvatarComponent` `src` shows a member's featured photo over the initials (ADR 0007), and `ListItemComponent` gained a `[meta]` slot for the role-badge meta line (`components/list.html`).
3. Nothing reusable: every profiles screen is composed from the library. `PictureListComponent` gained a per-photo `pending` flag for photos chosen but not saved yet (design system: `components/picture-list.html`).
4. Agile added to the library rather than building locally: the checkbox group's `legendHidden`, the card header actions slot (`ftCardActions`), the Kanban card `kind` and `moveTarget` inputs, the Kanban board's phone column tabs, and the top bar's tighter link padding between 1024px and 1279px. `CheckboxGroupComponent`, the tree's disclosure button, `EstimatePickerComponent`, `EstimateCardComponent` and `DangerZoneComponent` were already there.
