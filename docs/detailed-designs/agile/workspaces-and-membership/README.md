# Agile workspaces and membership

## Overview

The Community platform lets a holder of `OwnWorkspaces` (seeded as City Lead in FaithTech) run a team's work in an *Agile workspace*.

> **Agile workspace** — named container for a team's work items, run with either the Scrum or the Kanban method
>
> **workspace owner** — holder of `OwnWorkspaces` who created the workspace and manages its members, settings, sprints and archive state; a holder of `AdministerOrganisation` may do the same on any workspace as an audited override (`L2-135` AC5)
>
> **workspace member** — profile holding `JoinWorkspaces`, not suspended, that the owner has added to the workspace

Community data is organisation-wide, but workspace access comes from membership. Members create and edit items, move cards, comment and vote in Planning Poker. A holder of `ReadAllWorkspaces` reads every workspace and writes nothing. A holder of `AdministerOrganisation` may act on any workspace as an override, and each such action is audited (`L2-135` AC5). Any other signed-in user receives 404 for the workspace and its items, and none of its content appears in that user's global search.

This feature is the entry point of the agile subsystem. Every other agile feature (work items, board, sprints, switch method, archive and transfer, Planning Poker) relies on the membership model and the access policy defined here ([ADR 0011](../../../adr/0011-workspace-access-and-audit.md), refined by ADR 0033).

The repository layout in `AGENTS.md` lists the `Agile/` folders in `FaithTech.Community.Domain` and `FaithTech.Community.Application` and the `agile` feature library in `frontend/projects/` ([ADR 0010](../../../adr/0010-agile-feature-layout.md)).

## Description

The slice runs from the workspaces pages in the `agile` feature library to the Community database.

- **`WorkspacesPage`** — lists the live workspaces the caller may see and, for their owner and administrators, archived ones under **Archived** with **Restore** (mock `docs/mocks/pages/workspaces`). Opens `CreateWorkspaceDialog`.
- **`CreateWorkspaceDialog`** — CDK Dialog that captures a name, a method (Scrum or Kanban) and optional first members from `listMemberCandidates()` (mock `docs/mocks/dialogs/create-workspace`).
- **`WorkspaceFrameComponent`** — frame around every workspace page (backlog, board, settings, Planning Poker): header, tabs and the read-only alert when the caller's access is `Reader`.
- **`WorkspaceSettingsPage`** — name, method, members and archive for a caller who may manage the workspace (owner or an `AdministerOrganisation` override; mock `docs/mocks/pages/workspace-settings`). Anyone else sees the empty state "Only the owner changes settings" with "<owner> owns this workspace."; a member also reads "You can still add stories, move cards and vote in Planning Poker.", while a `Reader` sees only the first sentence plus the frame's read-only alert (`L2-031` AC4, AC5).
- **`AddWorkspaceMembersDialog`** and **`RemoveWorkspaceMemberDialog`** — CDK Dialogs for choosing one or more eligible profiles and confirming a removal (mocks `add-workspace-member`, `remove-workspace-member`).
- **`AgileService`** — API client contract in the `api` library, provided through the `AGILE_SERVICE` injection token and implemented by `HttpAgileService`: `listWorkspaces`, `createWorkspace`, `getWorkspace`, `renameWorkspace`, `switchMethod`, `listMemberCandidates`, `addMembers`, `removeMember`.
- **`WorkspacesEndpoints`** — minimal API group `/api/workspaces`: `GET`/`POST` `/`, `GET`/`PUT` `/{id}`, `PUT /{id}/method`, `GET /candidates`, `GET /{id}/candidates`, `POST /{id}/members`, `DELETE /{id}/members/{profileId}` (plus the sprint, archive and owner routes of the other agile designs). It validates the request record with `.Validate<T>()` and dispatches to a handler; it holds no business logic.
- **`CreateWorkspaceCommand`** / **`CreateWorkspaceValidator`** / **`WorkspacesHandler`** — `CreateAsync` accepts a caller for whom `ICurrentUser.Has(Capability.OwnWorkspaces)` is true (`AdministerOrganisation` holds it implicitly) and answers 403 to anyone else, records the caller as owner (a holder may own more than one), adds any `MemberIds` and returns the new `WorkspaceDto`; `ListAsync` returns `WorkspaceSummaryDto` rows (live ones through `WorkspaceAccessPolicy.Visible`, archived ones only to their owner and administrators, `NeedsNewOwner` only for live ones); `GetAsync` returns the `WorkspaceDto` with members, `Access`, `CanEdit` and `CanManage`, or null for a 404.
- **`WorkspaceMembership`** — `AddMembersAsync(workspace, actor, profileIds)` shared by create and settings. It adds only profiles whose current capabilities include `JoinWorkspaces` (`ProfileCapabilities.OfAsync`) and that are not suspended, otherwise adds nothing and the handler answers 400; each new member is notified through `AgileNotifier` (`WorkspaceMemberAdded`, linking to `/workspaces/{id}`).
- **`WorkspaceSettingsHandler`** — the owner's settings: `AddMembersAsync` (`AddWorkspaceMembersCommand`), `RemoveMemberAsync` (409 for the owner, 404 for a non-member; the member's assigned items in the workspace become unassigned in the same unit of work, `L2-031` AC8), `RenameAsync` (`RenameWorkspaceCommand`), `SwitchMethodAsync` (`SwitchMethodCommand`) and `CandidatesAsync` (non-suspended profiles holding `JoinWorkspaces` not yet in the workspace; without a workspace id, every such profile but the caller, for the create dialog). Every write goes through `WorkspaceAccessPolicy.AuthorizeAsync(manage: true)` and `AuditOverride`.
- **`WorkspaceAccessPolicy`** — Application service shared by every agile handler and the SignalR hub. `Classify` resolves the caller (`ICurrentUser`, `ProfileAccess.CallerProfileIdAsync`) as `Owner` → `Admin` (`Has(AdministerOrganisation)`, even when also a member) → `Member` → `Reader` (`Has(ReadAllWorkspaces)`) → `Outsider`, in that order. `WorkspaceCaller` exposes `CanRead` (anyone but an outsider), `CanEdit` (Member, Owner, Admin), `CanManage` (Owner, Admin) and `IsOverride` (Admin, the `AuthorizationRules.IsOverride` rule); `Refuse` answers 404 to an outsider and 403 to a reader without the right. `LoadAsync` and `AuthorizeAsync(manage)` load the workspace with that access; `Visible` filters lists in the database. `AuditOverride` writes only an Admin's writes to `IAuditLog` (`workspace.*`, `workitem.*`, `sprint.*`, `poker.*`); the owner's own actions are not audited (`L2-031`, `L2-042`, `L2-135` AC5, ADR 0011 refined by ADR 0033).
- **`Workspace`** — Domain entity with `Name`, `Method`, `OwnerId`, `IsArchived` and a `Members` collection of `WorkspaceMember`. `AddMember(profile, capabilities, now)` accepts only a profile whose capability set, passed by the caller, includes `JoinWorkspaces`, and rejects a duplicate; `RemoveMember(profileId, items)` unassigns that member's items (`L2-031` AC8); `IsMember` counts the owner as a member; `Rename` and `SwitchMethod` serve the settings page.
- **`WorkspaceMethod`** — enumeration `Scrum`, `Kanban`.
- **`AgileNotifier`** — Application service for in-app plus email notification. `Notify` adds a `Notification` to the unit of work and queues an email; `SendEmailsAsync`, called after `SaveChanges`, hands the emails to `IEmailSender`, whose Infrastructure implementation is the email outbox (`OutboxEmailSender`). Nobody is notified about their own action.
- **`IAuditLog`** — Application abstraction (`Application/Admin`) implemented in Infrastructure; `Record(actorId, action, targetType, targetId, before, after)`.
- **`CommunityDbContext`** — EF Core context in Infrastructure that persists workspaces and members to PostgreSQL; global query filters hide archived workspaces and items and scope every query to `ICurrentOrganisation`.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-031` | `L1-012` | Agile workspaces and membership |
| `L2-135` | `L1-026`, `L1-015` | Capability catalogue and server authorisation |

### Acceptance criteria

**`L2-031` — Agile workspaces and membership**

1. Given a holder of `OwnWorkspaces`, when they create a workspace with a name and a method (Scrum or Kanban), then they become its owner. A holder of `OwnWorkspaces` can own more than one workspace; a member without it is not offered "New workspace" and the API answers 403.
2. Given the owner, when they add members, then only profiles holding `JoinWorkspaces` can be chosen, and each added member is notified.
3. Given a member, when they open the workspace, then they can create and edit stories and tasks, move cards, comment and vote in Planning Poker. Only the owner creates and edits initiatives and epics.
4. Given a member who is not the owner, when they try to manage members, change settings, manage sprints, or archive the workspace, then the control is hidden and the API returns 403.
5. Given a holder of `ReadAllWorkspaces` who is not a member, when they open any workspace, then they can view it but every write returns 403.
6. Given a non-member who holds neither `ReadAllWorkspaces` nor `AdministerOrganisation`, when they request the workspace or its items, then the response is 404, and nothing appears in their search.
7. Given a holder of `AdministerOrganisation`, when they act on any workspace they do not own or belong to, then the action succeeds as an override and is audited (`L2-135` AC5).
8. Given a removed member, when the removal completes, then their assigned items become unassigned.

**`L2-135` — Capability catalogue and server authorisation**

1. Given the platform, when `GET /api/organisation/capabilities` is called by any member, then it lists exactly: `ManageEvents`, `ViewAttendees`, `ManageAttendance`, `KeepContacts`, `ViewPartners`, `ManagePartners`, `InviteMembers`, `ConnectLink`, `OwnWorkspaces`, `JoinWorkspaces`, `ReadAllWorkspaces`, `ViewPeopleDirectory`, `AssignRoles`, `SendAnnouncements`, `AddResources`, `ViewReports`, `ManageRoles`, `ManageOrganisationSettings`, `AdministerOrganisation`, each with a one-line description, and no organisation can add, rename or remove one.
2. Given a request, when the server authorises it, then it checks the caller's capabilities, computed on that request from the union of the capabilities of every non-archived role the caller's profile holds in the current organisation, and never compares a role name.
3. Given a holder of `AdministerOrganisation`, when any capability is checked, then it is held.
4. Given an action that needs a capability the caller lacks, when it is called, then the response is 403 (or 404 where `L2-042` AC2 hides existence), and nothing changes.
5. Given an action the caller is allowed only because they hold `AdministerOrganisation` (they lack the specific capability, or do not own the record), when it succeeds, then it is an override and an audit entry is written (`L2-041`); given the caller holds the specific capability or owns the record, then it is not audited (role changes excepted, `L2-138` AC5).
6. Given every signed-in member of the organisation, when they view profiles, the team, events and announcements, RSVP, open resources and notes visible to them, create their own notes, search, or edit their own profile and settings, then no capability is required.
7. Given the frontend, when it decides what to show, then it reads capabilities from `/api/me`, never role names, and hiding is a convenience only: the server refuses what the member may not do.

## Diagrams

### System context

Holders of `OwnWorkspaces` own workspaces, members work in them, holders of `ReadAllWorkspaces` read them and administrators override them. The system emails members when they are added.

![C4 system context for Agile workspaces and membership](diagrams/c4-context.png)

### Containers

The `agile` library in the Web app calls the Community API, which persists workspaces in PostgreSQL and sends email through the provider from its outbox.

![C4 container view for Agile workspaces and membership](diagrams/c4-container.png)

### Components

`WorkspacesEndpoints` dispatches to `WorkspacesHandler` and `WorkspaceSettingsHandler`, which ask `WorkspaceAccessPolicy` before loading or changing a `Workspace`. Both add members through `WorkspaceMembership`, which notifies them through `AgileNotifier`; an Admin override is written to `IAuditLog`.

![C4 component view for Agile workspaces and membership](diagrams/c4-component.png)

### Class structure

`Workspace` composes its `WorkspaceMember` rows. `WorkspacesHandler` and `WorkspaceSettingsHandler` each handle the request records of one concern and depend on `WorkspaceAccessPolicy`, which classifies the caller as a `WorkspaceAccess` value wrapped in `WorkspaceCaller`.

![Class diagram for Agile workspaces and membership](diagrams/class-structure.png)

### Behaviour — create a workspace

`WorkspacesHandler.CreateAsync` accepts the command only from a holder of `OwnWorkspaces`, records the caller as owner and adds any first members through `WorkspaceMembership` (`L2-031`).

![Sequence diagram: create a workspace](diagrams/sequence-create-workspace.png)

### Behaviour — add workspace members

Only the owner or an administrator may add members, and only non-suspended profiles holding `JoinWorkspaces` are eligible; each new member is notified in-app and by email, and an `AdministerOrganisation` override is audited (`L2-031`).

![Sequence diagram: add workspace members](diagrams/sequence-add-member.png)

### Behaviour — remove a workspace member

`WorkspaceSettingsHandler.RemoveMemberAsync` clears that member as assignee from every item in the workspace within the same unit of work (`L2-031`).

![Sequence diagram: remove a workspace member](diagrams/sequence-remove-member.png)

### Behaviour — open a workspace

Reads resolve the caller's access first through `WorkspaceAccessPolicy.LoadAsync`; outsiders receive 404 so the workspace's existence is not revealed, and the `WorkspaceDto` carries `access`, `canEdit` and `canManage` for the page (`L2-031`).

![Sequence diagram: open a workspace](diagrams/sequence-open-workspace.png)

## Open questions

Decisions recorded while building the feature:

- Domain types for the agile subsystem live in `FaithTech.Community.Domain/Agile/`, the folder name these designs use; `AGENTS.md` lists it.
- `AddMember` takes the `Profile` and its capability set so the Domain enforces the `JoinWorkspaces` rule itself; the owner cannot be removed as a member.
- Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
- Handlers are grouped by concern (`WorkspacesHandler`, `WorkspaceSettingsHandler`) rather than one class per command. Request records (`CreateWorkspaceCommand`, `AddWorkspaceMembersCommand`, `RenameWorkspaceCommand`, `SwitchMethodCommand`) are validated by FluentValidation at the endpoint; there are no separate query types, `ListAsync` and `GetAsync` are handler methods.
- `WorkspaceAccessPolicy.Classify` runs Owner → Admin → Member → Reader → Outsider. An administrator who owns the workspace is its owner and is not audited; an administrator who merely belongs to it is still `Admin`, so every action succeeds and is audited (`L2-031` AC7, ADR 0011). `AuditOverride` records only Admin writes; the owner's and members' own actions are never audited.
- Eligible members are non-suspended profiles holding `JoinWorkspaces`; `CandidatesAsync` and `WorkspaceMembership.AddMembersAsync` apply the same rule, and the create dialog may add first members in the same request.
- Notifications go through `AgileNotifier` (in-app `Notification` plus email through the outbox after the save); there is no `INotificationService`.
- Search (L2-031 AC6, L2-026 AC2) is deferred: global search is not built yet. When work items are indexed, the search query applies the same member, `ReadAllWorkspaces` or `AdministerOrganisation` filter as `WorkspaceAccessPolicy.Visible` and leaves out archived items (ADR 0011).
- `WorkspaceMemberDto.IsYou` marks the caller, so the web app can show "(you)" and leave the facilitator out of Planning Poker invites without knowing its own profile id.
- Capabilities: the owner holds `OwnWorkspaces`, members hold `JoinWorkspaces`, the read-only access kind is renamed `Reader` and keyed on `ReadAllWorkspaces`, and `Admin` is keyed on `AdministerOrganisation`; `AddMember` takes the profile's capability set in place of `TeamRoles.IsTeamMember`, which is deleted (ADR 0033).
