# Screen composition

Which `@faithtech-community/components` parts build each screen, and what is built locally in the feature library. Sources: the mocks in `docs/mocks/` (states listed per screen) and the public API of `frontend/projects/components/src/public-api.ts`. Mock-only chrome (`mock-bar`, `mock-note`) is excluded.

**Local UI** is markup a feature library writes itself. It is limited to page composition: headings that belong to the page, sections and the glue between `api` services and components. Anything reusable goes into `components` first (`AGENTS.md`).

Coverage: the profiles screens (`profile`, `edit-profile`, `delete-photo`), the admin screens (`admin-users`, `audit-log`, `add-role`, `remove-role`, `suspend-user`), the invites screens (`invites`, `accept-invite`, `send-invite`), the team list (`team`), the events screens (`events`, `event-form`), the Appearance card of settings (`settings`), the contacts screens (`contacts`, `contact`, `contact-form`, `archived-contacts`, `add-note`, `archive-contact`, `delete-contact`, `link-contact`), the partners screens (`partners`, `partner`, `partner-form`, `add-partner`, `move-partner`) and the agile screens (`workspaces`, `team-board`, `backlog`, `work-item`, `workspace-settings`, `planning-poker` and their dialogs). Other screens are added here as their features are built.

## Shell

| Part | Library | Local |
|---|---|---|
| App shell around `/people/**`, `/team`, `/admin/**`, `/invites`, `/contacts/**`, `/partners/**`, `/workspaces/**` | `TopBarComponent` with the account menu (`MenuComponent` "Account menu for {name}" whose face is an `AvatarComponent`: *Your profile* → `/people/me`, *Settings* → `/settings`, *Sign out*), `NavDrawerComponent`, `TabBarComponent` (top bar, tab bar and menu all from `shell/navigation.ts`, one rule by role, ADR 0012), `SkipLinkComponent`, `ToastRegionComponent` (in `AppShellComponent`). System Admins get an **Admin** link (secondary) to `/admin`. | — |

## Pages

### Profile — `/people/:id`, `/people/me` (`pages/profile`: default, own, loading, empty, error, not-found)

- Library: `ProfileHeaderComponent` (featured photo, or initials without one, in an XL `AvatarComponent`, name as the `h1`, `BadgeComponent` roles, home city, bio, photo strip of `PhotoComponent`), `ButtonComponent` (*Edit profile*, *Add photos*, *Try again*, *Go home*), `EmptyStateComponent` (no photos on the own profile; error variant for load failure; not-found).
- Loading uses `ProfileHeaderComponent [loading]` (skeletons, `aria-busy`).
- Own state adds *Edit profile* in the header's `[actions]` slot; the admin state (a System Admin on another member, `CanEdit`) adds it too, linking to `/people/{id}/edit`.
- *Add a role* and *Remove a role* (`ButtonComponent` in the `[actions]` slot) appear when `assignableRoles` from `api` offers an option for the caller (City Lead or System Admin, L2-009); each opens `RoleDialogComponent` through `DialogService` (ADR 0005) and the role badges update from the API's answer.
- Local: none beyond composition. The `h1` for the error and not-found states is a visually hidden page heading.

### Edit profile — `/people/me/edit`, `/people/:id/edit` (`pages/edit-profile`: default, admin, loading, error, invalid, busy, success, uploading, too-large, pending, storing, full, forbidden)

- Library: `BreadcrumbComponent` + `BreadcrumbItemComponent`, `PageHeaderComponent`, `CardComponent` (About you, Photos), `StackComponent`, `FormFieldComponent` + `TextFieldComponent` (Name, Home city), `FormFieldComponent` + `TextareaComponent` (Bio), `PictureListComponent` (photos, descriptions, Feature, Remove, Add photos, uploading, failed, pending, storing and full states), `ErrorSummaryComponent` (invalid), `FormActionsComponent` + `ButtonComponent` (*Save profile* with `loading`, *Cancel*), `SkeletonComponent` (loading), `EmptyStateComponent` error variant (error), `ToastService` (success: "Profile saved").
- Opens `DeletePhotoDialog` through `DialogService` from a saved photo's Remove.
- Admin state: the breadcrumb names the member, the header reads "Edit {name}’s profile" with the audit note, and Cancel returns to their profile. Forbidden state: `EmptyStateComponent` "You can only edit your own profile" with *Back to profile* and no form.
- Local: the `<form>` element and the section headings.

### People and roles — `/people` (`pages/people`: default, admin, read-only, loading, error, no-results, forbidden)

- Library: `PageHeaderComponent` ("People and roles", subtitle by role) with *Invite someone* (`ButtonComponent` `primary` link to `/invites`, City Leads and System Admins), `TextFieldComponent` `type="search"` labelled "Search people", `TableComponent` caption "Members and their roles" (cell templates: `AvatarComponent` `sm` with the featured photo + `LinkComponent` to `/people/:id`; `BadgeComponent` `role` per role or "No role yet"; City; `ButtonComponent` *Add role* and ghost *Remove* with the member's name as `object`, or the caption "Only System Admin can change"), `ListSkeletonComponent` (5 rows), `EmptyStateComponent` (no-results "No one matches “{term}”" with *Invite someone*; error with *Try again*; forbidden "Only City Leads manage roles" with *Back to home*), `ButtonComponent` *Show more people* when more than 25.
- Opens `RoleDialogComponent` through `DialogService` (ADR 0005); the row's badges update from the API's answer.
- Local: the search `<form role="search">`.

### Admin users — `/admin/users` (`pages/admin-users`: default, loading, error, no-results, forbidden)

- Library: `PageHeaderComponent` ("Admin"), `TabsComponent` + `TabComponent` in navigation mode (Users, Audit log), `TextFieldComponent` `type="search"` labelled "Search users", `TableComponent` (cell templates: `AvatarComponent` + `LinkComponent` to the profile; `BadgeComponent` `role` per role or "No role"; `BadgeComponent` status — Active `success`, Suspended `danger`, Unverified `warning`; ghost `ButtonComponent` *Suspend {name}* or *Reinstate {name}*), `ListSkeletonComponent` (loading), `EmptyStateComponent` (no-results with *Clear search*; error variant with *Try again*; forbidden with *Back to home*), `ButtonComponent` *Show more users* when more than 25.
- Opens `SuspendUserDialog` through `DialogService`.
- `AlertComponent` `warning` "A workspace needs a new owner" for each live workspace whose owner lost City Lead (from `AGILE_SERVICE.listWorkspaces`), with *Open workspace settings* (`ButtonComponent` link) in `ftAlertActions` (L2-037 AC2).
- Local: the search `<form role="search">`.

### Audit log — `/admin/audit-log` (`pages/audit-log`: default, loading, empty, error, no-results, exporting, exported, export-failed)

- Library: `PageHeaderComponent` with *Export CSV* (`ButtonComponent` with `loading` while exporting, `IconComponent` `export`; `ToastService` "Audit log exported" or a danger toast with *Try again*), `TabsComponent` + `TabComponent`, `FormFieldComponent` + `SelectComponent` "Action" (all, role changes, suspensions, private contact access, deletions), `TableComponent` (When monospaced, Who, What; `loading` shows skeleton rows under the headers), `EmptyStateComponent` (empty; no-results "No {category} in the last 90 days" with *Show all actions*; error; forbidden as on admin users), `ButtonComponent` *Show older entries* when more than 50.
- Local: the CSV download glue (object URL and a temporary link).

### Invites — `/invites` (`pages/invites`: default, loading, empty, error, more, more-error)

- Library: `BreadcrumbComponent` + `BreadcrumbItemComponent` (People and roles → Invites), `PageHeaderComponent` with *Invite someone*, `CardComponent` `flush` + `ListComponent` + `ListItemComponent` (email, "{role} · Sent {day} · expires {day}" meta, trailing `BadgeComponent` — Pending `info`, Accepted `success`, Expired `warning`, Withdrawn `neutral` — and a ghost *Resend* on expired invites), `ListSkeletonComponent` (3 rows), `EmptyStateComponent` (empty with *Invite someone*; error with *Try again*), `ToastService` ("Invite sent to {email}", "Invite sent again"). Paging (more, more-error): `ClusterComponent` (the "Showing N of M invites" count and *Show more invites* `ButtonComponent` with `loading`), and `AlertComponent` danger ("We couldn’t load more invites. Try again.").
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
- The list is cards at every width; there is no table (ADR 0014).
- Local: the search `<form role="search">`; the visually hidden `h1` of the forbidden state.

### Contact — `/contacts/:id` (`pages/contact`: default, loading, error, match, linked)

- Library: `BreadcrumbComponent`, `PageHeaderComponent` (subtitle "Private contact · only you can see this", "Member · linked profile" or, for a System Admin, "Another lead’s private contact · your access is recorded") with *Edit* (`href`) and ghost *Archive*, `AlertComponent` (match "{name} has joined FaithTech" with *Link to their profile* and *Not them*; linked success), `SplitComponent`, `CardComponent` (notes; Details), `BadgeComponent` Private, `ButtonComponent` *Add note*, `NoteComponent` with `formatDay`, `DescriptionListComponent` + `DescriptionListItemComponent` (Email as a `mailto:` `LinkComponent`, Phone, Organisation, City — a missing one reads "Not added" through `[missing]` — and Added "{day} by you"; `[loading]` skeleton values while loading), `NoteComponent` `[loading]` note-shaped skeletons, `PhotoComponent` (the linked member's featured photo), `LinkComponent` *View their profile*, `EmptyStateComponent` (not found, error).
- Opens `AddNoteDialog`, `ArchiveContactDialog` and `LinkContactDialog` through `DialogService`; archiving returns to `/contacts` with a `ToastService` success toast.
- Local: the notes section heading.

### Add / edit contact — `/contacts/new`, `/contacts/:id/edit` (`pages/contact-form`: default, edit, invalid, duplicate, busy, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent`, `StackComponent` `width="sm"` holding `CardComponent`, `ErrorSummaryComponent` ("Fix N things to save"), `FormErrorFocusDirective`, `AlertComponent` (duplicate "{name} is already a member"; error), `FormFieldComponent` + `TextFieldComponent` (Name, Email with help, Phone, Organisation, City), `TextareaComponent` (First note, create only), `FormActionsComponent` + `ButtonComponent` (*Cancel*, then *Save contact* or *Save and link*), `SkeletonComponent`, `EmptyStateComponent` error.
- Local: the `<form>` element.

### Archived contacts — `/contacts/archived` (`pages/archived-contacts`: default, loading, empty, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent`, `CardComponent` `flush` + `ListComponent` + `ListItemComponent` ("Archived {day} · {city}" meta, leading `AvatarComponent`, trailing `ClusterComponent` with *Restore* and ghost *Delete*, each naming the contact through the button's visually hidden `object`), `ListSkeletonComponent`, `EmptyStateComponent` (Nothing archived with *Back to contacts*; error; forbidden), `ToastService` ("Contact restored", "Contact deleted").
- Opens `DeleteContactDialog` through `DialogService`.
- Local: none beyond composition.

### Partners — `/partners` (`pages/partners`: default, loading, empty, error, read-only, dragging, tabs)

- Library: `PageHeaderComponent` ("Shared by every lead · {n} partners") with *Add partner* for lead roles and System Admin, `AlertComponent` info "Read-only for Staff", `KanbanBoardComponent` (label "Partner pipeline", polite `announcement` after each move) + `KanbanColumnComponent` (Lead, In funnel, Confirmed with counts; `cardDropped`) + `KanbanCardComponent` (link, "{contact} · {offering}" caption, *Move* when the caller can edit), the board's own column tabs below 640px ("Partner pipeline columns": Lead, In funnel, Confirmed with counts, one column at a time), `CardComponent` + `SkeletonComponent` (loading), `EmptyStateComponent` (Start your partner pipeline; error; forbidden "The partner pipeline is for leads"), `ToastService`.
- Opens `AddPartnerDialog` and `MovePartnerDialog` through `DialogService`.
- Local: the column template rendered in both layouts (declared inside the board so the columns share its drop-list group).

### Partner — `/partners/:id` (`pages/partner`: default, loading, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent` with the `ftPageHeaderSubtitle` slot (`BadgeComponent` stage — Lead `neutral`, In funnel `warning`, Confirmed `success` — and the offering), *Move stage* and ghost *Edit* for lead roles and System Admin, `SplitComponent`, `CardComponent` (Stage history; Details), `FeedComponent` + `FeedItemComponent` ("{who} moved {partner} from {stage} to {stage}: “{note}”", `formatDay`), `DescriptionListComponent` (Contact, Email as a `mailto:` link, Phone, Website, Offering, Owner, Notes; a missing one reads "Not added"), `SkeletonComponent`, `EmptyStateComponent` (not found, error).
- Opens `MovePartnerDialog` through `DialogService`.
- Local: none beyond composition.

### Edit partner — `/partners/:id/edit` (`pages/partner-form`: default, loading, invalid, busy, error)

- Library: `BreadcrumbComponent`, `PageHeaderComponent`, `StackComponent` `width="sm"` holding `CardComponent`, `ErrorSummaryComponent`, `FormErrorFocusDirective`, `AlertComponent` (error), `FormFieldComponent` + `TextFieldComponent` (Organisation, Website, What they could offer, Main contact, Email, Phone), `SelectComponent` (Owner: "No owner" and the members with a lead role), `TextareaComponent` (Notes), `FormActionsComponent` + `ButtonComponent` (*Cancel*, then *Save partner*), `SkeletonComponent`, `EmptyStateComponent` (error; read-only for Staff).
- Local: the `<form>` element.

### Workspaces — `/workspaces` (`pages/workspaces`: default, member, staff, empty, empty-member, loading, error, archived)

- Library: `PageHeaderComponent` with *New workspace* (City Lead, System Admin), `AlertComponent` (Read-only for Staff), `CardComponent` `flush` + `ListComponent` + `ListItemComponent` (`IconTileComponent` leading, "Owner: … · Scrum · Sprint 7 active · 5 members" meta, `BadgeComponent` *Owner*), a second card *Archived* with *Restore* (`ButtonComponent`, `IconComponent` `restore`), `ListSkeletonComponent`, `EmptyStateComponent` (empty for leads and for members; error).
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
- Opens `StartPokerDialog`. Changes arrive through `AGILE_LIVE_SERVICE.watchPokerSession` and the page re-reads the session (ADR 0012).
- Local: the "Now estimating" overline and story heading.

### Events — `/events` (`pages/events`: default, member, loading, empty, no-results, error)

- Library: `PageHeaderComponent` ("Events", "Builders nights, hackathons and gatherings across every city") with *New event* (`ButtonComponent` `primary` link to `/events/new` with `IconComponent` `add`, Event Leads, City Leads and System Admins only; `member` hides it), `ChipGroupComponent` "Filter events" of `ChipComponent` toggles (Upcoming, Past, Hackathons, Online; one pressed), `FormFieldComponent` + `SelectComponent` (City: All cities and every city with an event), `CardComponent` `flush` + `ListComponent` "Events" of `EventCardComponent` (date leaf from `formatMonth`, title linking to `/events/:id`, meta "date · time · city · venue or Online · N going" from `formatDayRange` and `formatTime`, `public`, `members` or `cancelled` badge), `ListSkeletonComponent` `leading="date-badge"` (4 rows), `EmptyStateComponent` (empty with *New event* for event managers; no-results "No upcoming events in {city}" with *Show all cities* or *Show upcoming events*; error with *Try again*).
- Local: none beyond composition.

### New / edit event — `/events/new`, `/events/:id/edit` (`pages/event-form`: default, edit, loading, error, invalid, busy)

- Library: `BreadcrumbComponent` (Events → the event → New event or Edit event), `PageHeaderComponent`, `StackComponent` `width="lg"`, `ErrorSummaryComponent` ("Fix N things to publish" or "to save"), `FormErrorFocusDirective`, `AlertComponent` danger (save failed), `CardComponent` with `heading` (Details; When and where; Who can see and RSVP), `FormFieldComponent` + `TextFieldComponent` (Title; Starts and Ends `type="datetime-local"` in a `GridComponent` `[columns]="2"`; City; Venue address, or Joining link `type="url"` when Online; Capacity `type="number"`, optional, "Leave empty for no limit."), `SelectComponent` (Type: Gathering, Builders night, Hackathon, Prayer & planning, Panel), `TextareaComponent` (Description, optional), `RadioGroupComponent` + `RadioComponent` (Format: In person, Online with its description; Visibility: Public, Members only with descriptions), `FormActionsComponent` + `ButtonComponent` (*Cancel* ghost link, *Publish event* or *Save changes* with `loading`), `SkeletonComponent` cards in a labelled `status` (loading), `EmptyStateComponent` error with *Try again* and *Back to events*.
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
| Delete contact permanently (`dialogs/delete-contact`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`tone="danger"`, `icon="delete"`), `FormFieldComponent` + `TextFieldComponent` ("Type DELETE to confirm", `initialFocus`, error after leaving the field), `AlertComponent`, `ButtonComponent` (*Cancel*, *Delete permanently* `danger`, disabled until the text is exactly DELETE) | The `<form>` element (`DeleteContactDialog` in `contacts`) |
| Link contact to profile (`dialogs/link-contact`: default, busy, failed) | `DialogService` | `DialogComponent` (`icon="link"`), `ClusterComponent` + `AvatarComponent` (the member), `RadioGroupComponent` + `RadioComponent` (keep or discard the notes), `AlertComponent`, `ButtonComponent` (*Cancel*, *Link profile*) | — (`LinkContactDialog` in `contacts`) |
| Add partner (`dialogs/add-partner`: default, invalid, busy, failed) | `DialogService` | `DialogComponent` (`icon="partners"`), `FormFieldComponent` + `TextFieldComponent` (Organisation, Website, Main contact, Email, Phone), `SelectComponent` (Stage, Lead by default; Owner), `TextareaComponent` (What they could offer, Notes), `AlertComponent`, `ButtonComponent` | The `<form>` element (`AddPartnerDialog` in `partners`) |
| Move partner (`dialogs/move-partner`: default, busy, failed) | `DialogService` | `DialogComponent` (`icon="move"`), `RadioGroupComponent` + `RadioComponent` (the three stages, the current one marked "Current stage"), `FormFieldComponent` + `TextareaComponent` (Note for the history), `AlertComponent`, `ButtonComponent` (*Cancel*, *Move to {stage}*, disabled for the current stage) | The `<form>` element (`MovePartnerDialog` in `partners`) |
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

None for profiles. Admin and invites use `ToastService` success toasts on the invites page; role changes and accepted invites raise in-app notifications that the notifications feature will show. Agile screens use `ToastService` toasts for saves, moves, archive and restore; member additions, assignments, Planning Poker invites and an owner losing City Lead raise in-app notifications and emails. Contacts and partners use `ToastService` toasts (archived, restored, deleted, partner added, a failed drag); a contact who verifies their email raises a `ContactSignedUp` in-app notification and an email to the owning lead.

## Summary of local UI to build

1. Admin and invites added to the library rather than building locally: `RoleDialogComponent` (shared by `profiles` and later `admin` screens, ADR 0005), `ListSkeletonComponent` (loading lists and tables), `EmptyStateComponent` `headingLevel` 1 (full-page errors on the accept-invite page), `TableComponent` now contains its visually hidden headers so tables scroll inside their frame on phones, and `formatDay` / `formatTimestamp` give the mocks' date formats from the browser's `Intl` (keeping Angular's locale data out of the initial bundle).
2. Team added to the library: `AvatarComponent` `src` shows a member's featured photo over the initials (ADR 0007), and `ListItemComponent` gained a `[meta]` slot for the role-badge meta line (`components/list.html`).
3. Nothing reusable: every profiles screen is composed from the library. `PictureListComponent` gained a per-photo `pending` flag for photos chosen but not saved yet, and a `storing` flag for saved photos whose image is still being written while storage is down (design system: `components/picture-list.html`).
4. Agile added to the library rather than building locally: `IconTileComponent` (the list rows' leading icon, now that `ft-sticker` is gone), the checkbox group's `legendHidden`, the card header actions slot (`ftCardActions`), the Kanban card `kind` and `moveTarget` inputs, the Kanban board's phone column tabs, and the top bar's tighter link padding between 1024px and 1279px. `CheckboxGroupComponent`, the tree's disclosure button, `EstimatePickerComponent`, `EstimateCardComponent` and `DangerZoneComponent` were already there.
5. Contacts and partners added to the library rather than building locally: `PageHeaderComponent` gained an `ftPageHeaderSubtitle` slot, `TextFieldComponent` gained `initialFocus` (the delete-contact confirmation) and `KanbanCardComponent`'s name link keeps a 24px target for rich subtitles such as the partner's stage badge. Everything else is composed from existing components; the add-partner dialog and the partner form share their field rules in the feature's `partner-fields.ts`.
6. Events added to the library: `formatTime` ("6:30 pm"), `formatMonth` ("Nov") and `formatDayRange` ("Sat 14 – Sun 15 Nov") join the date formats.

### Settings — `/settings` (`pages/settings`: Appearance card only so far)

- Library: `PageHeaderComponent` ("Settings"), `StackComponent` `width="md"`, `CardComponent` heading "Appearance" holding `RadioGroupComponent` (legend "Theme") with `RadioComponent` *Light*, *Dark* and *Match my device* (with its description), bound to `ThemeService` from `components` (L2-045 AC6).
- The Account and Email me when cards and Sign out everywhere join when their designs are built.
- Local: the caption "Changes straight away and is remembered on this device."
