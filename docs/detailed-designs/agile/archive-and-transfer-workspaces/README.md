# Archive and transfer workspaces

## Overview

Workspaces and work items are never hard-deleted by their owners; they are archived.

> **archive** — soft delete that hides a workspace or work item from normal views while keeping it restorable
>
> **ownership transfer** — reassignment of a workspace by a holder of `AdministerOrganisation` to another holder of `OwnWorkspaces` (seeded as City Lead in FaithTech)

The workspace owner archives a workspace or an item and may restore it; a holder of `AdministerOrganisation` may also archive and restore it, as an audited override (`L2-135` AC5). An archived workspace answers 404 to members and holders of `ReadAllWorkspaces`; its owner and administrators still list it under **Archived** so they can restore it. When an owner loses `OwnWorkspaces` (their role was removed or its definition lost the capability, `L2-139` AC3), every administrator is notified in-app and by email and reassigns ownership to another holder of `OwnWorkspaces` from the workspace settings. Reassignment needs `AdministerOrganisation` and is always written to the audit log ([ADR 0011](../../../adr/0011-workspace-access-and-audit.md), refined by ADR 0033). Every query is scoped to the current organisation by the DbContext's global filter on `ICurrentOrganisation`.

## Description

- **`WorkspaceSettingsPage`** — for the owner and an administrator: **Archive workspace** (opens `ArchiveWorkspaceDialog`, then navigates to `/workspaces`) and the archived items list with **Restore** (`getArchivedItems`, `restoreWorkItem`; mock `docs/mocks/pages/workspace-settings`). When the workspace `needsNewOwner` and the caller's access is `Admin` it shows "This workspace needs a new owner" with **Reassign owner** (state `needs-owner`).
- **`WorkspacesPage`** — lists archived workspaces to their owner and administrators under **Archived**, each with **Restore** (`restoreWorkspace`, state `archived`). Members and holders of `ReadAllWorkspaces` do not see them.
- **`AdminUsersPage`** (`admin` library) — shows "A workspace needs a new owner" for each live workspace that `listWorkspaces()` marks `needsNewOwner`, linking to `/workspaces/{id}/settings`. The admin library may not depend on the agile library, so the dialog opens from settings.
- **`ArchiveWorkspaceDialog`** and **`ArchiveWorkItemDialog`** — CDK Dialogs confirming the archive (`archiveWorkspace`, `archiveWorkItem`; mocks `archive-workspace`, `archive-work-item`). The work item page offers Archive only when the item's `canManage` is true (`L2-037` AC3).
- **`ReassignOwnerDialog`** — CDK Dialog for an administrator to pick a new owner holding `OwnWorkspaces` from `listOwnerCandidates` and call `reassignOwner` (mock `docs/mocks/dialogs/reassign-owner`). It opens from workspace settings, which the admin users alert and the notification link to.
- **`AgileService`** — `api` contract (`AGILE_SERVICE`, `HttpAgileService`): `archiveWorkspace`, `restoreWorkspace`, `getArchivedItems`, `archiveWorkItem`, `restoreWorkItem`, `listOwnerCandidates`, `reassignOwner`, plus `listWorkspaces` for `isArchived` and `needsNewOwner`.
- **`WorkspacesEndpoints`** — maps `POST /api/workspaces/{id}/archive` and `/restore`, `GET /api/workspaces/{id}/archived-items`, `GET /api/workspaces/{id}/owner-candidates`, `PUT /api/workspaces/{id}/owner`, and `POST /api/items/{id}/archive` and `/restore`, all to `ArchiveHandler`.
- **`ArchiveHandler`** — `ArchiveWorkspaceAsync`, `RestoreWorkspaceAsync`, `ArchiveItemAsync`, `RestoreItemAsync`, `ArchivedItemsAsync`, `OwnerCandidatesAsync` and `ReassignOwnerAsync`. Archive and restore authorize with `WorkspaceAccessPolicy.AuthorizeAsync(manage: true)` (owner or administrator; the workspace routes load with `includeArchived`), answer 409 when already in the target state, and call `AuditOverride` so only an `AdministerOrganisation` override is written to the audit log (`workspace.archived`, `workspace.restored`, `workitem.archived`, `workitem.restored`). Anyone who cannot manage an archived workspace gets 404, so only the owner and administrators know it exists. `ArchivedItemsAsync` lists archived items whose parent is not archived, newest first, as `ArchivedItemDto`.
- **`Workspace.Archive()`** / **`Restore()`** — set only `IsArchived`; the workspace records no `ArchivedById` or `ArchivedAt`. **`WorkItem.Archive(items, archivedById, now)`** sets `IsArchived`, `ArchivedById` and `ArchivedAt` on the item and its whole subtree; `Restore(items)` reverses it. `CommunityDbContext` applies a global EF query filter (`!IsArchived`) to workspaces and items, so normal reads never see archived rows.
- **`ReassignOwnerCommand`** (`OwnerId`) / **`ArchiveHandler.ReassignOwnerAsync`** — `AdministerOrganisation` only: 404 when the caller cannot read the workspace, 403 for a caller without `AdministerOrganisation`, 400 when the chosen profile is suspended or its current capabilities lack `OwnWorkspaces`. `Workspace.ReassignOwner(newOwner, capabilities, now)` rejects a profile whose capability set lacks `OwnWorkspaces` and keeps the former owner as a member. Always audited through `WorkspaceAccessPolicy.Audit` as `workspace.owner.reassigned` (`L2-037` AC2). `OwnerCandidatesAsync` offers non-suspended holders of `OwnWorkspaces` other than the current owner.
- **`CapabilityLostHandler`** (renaming `CityLeadRoleRemovedHandler`) — Application handler for the `CapabilityLost(profile, capability)` domain event that `Profile.RemoveRole` raises when a removed role carried a capability no remaining role still gives, and that `CapabilityLossDetector` raises for every holder when a definition edit drops one (`L2-139` AC3); it reacts to `OwnWorkspaces` only. `ChangeRolesHandler` (`Application/Admin`) and `UpdateRoleDefinitionHandler` (`Application/Organisations`) call `HandleAsync` before `SaveChanges` and `SendEmailsAsync` after it. The handler reads the filtered `db.Workspaces`, so archived workspaces are skipped, and notifies every non-suspended administrator, the acting one included, of each live workspace the former owner holds through `AgileNotifier` (`WorkspaceOwnerLostCapability`, "{Name} no longer holds a role that can own workspaces: {workspace list}", in-app and by email, linking to `/workspaces/{id}/settings`, `L2-139` AC4).
- **`WorkspacesHandler.ListAsync`** — lists archived workspaces only to their owner and administrators and sets `NeedsNewOwner` only for a live workspace whose owner's current capabilities lack `OwnWorkspaces` (`ProfileCapabilities.OfAsync`); an archived workspace is not flagged until it is restored.
- **`WorkspaceAccessPolicy`** — Application service shared by every agile handler. `Classify` resolves the caller as `Owner` → `Admin` (`Has(AdministerOrganisation)`, even when also a member) → `Member` → `Reader` (`Has(ReadAllWorkspaces)`) → `Outsider`; `CanManage` is Owner or Admin. Outsiders receive 404, Readers and non-owner members receive 403 on writes they lack. `AuditOverride` records only Admin writes to `IAuditLog`; the owner's own actions are not audited. `Audit` records actions only `AdministerOrganisation` may take, such as reassigning the owner (`L2-031`, `L2-042`, `L2-135` AC5, ADR 0011 refined by ADR 0033).
- **`AgileNotifier`** and **`IAuditLog`** — `AgileNotifier` adds the in-app `Notification` to the unit of work and, through `QueueEmailsAsync`, queues the emails in `IEmailQueue` (the email outbox) before the save, so they commit with the change; `IAuditLog` (`Application/Admin`) is the audit abstraction. There is no `INotificationService`.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-037` | `L1-012` | Archive and ownership of workspaces |
| `L2-135` | `L1-026`, `L1-015` | Capability catalogue and server authorisation |
| `L2-139` | `L1-026`, `L1-014` | Last administrator and consequences of role changes |

### Acceptance criteria

**`L2-037` — Archive and ownership of workspaces**

1. Given the owner, when they archive a workspace or an item, then it is hidden from normal views and can be restored by the owner or by a holder of `AdministerOrganisation` (an override, audited, `L2-135` AC5). Archiving a story also archives its tasks.
2. Given an owner who loses `OwnWorkspaces` (their role was removed or its definition lost the capability, `L2-139` AC3), when `CapabilityLost(OwnWorkspaces)` is handled, then every holder of `AdministerOrganisation` is notified (`WorkspaceOwnerLostCapability`, `L2-139` AC4) and a holder of `AdministerOrganisation` can reassign ownership to another holder of `OwnWorkspaces`; the workspace keeps working meanwhile.
3. Given a member who is not the owner, when they view an item, then no Archive action is shown.

**`L2-135` — Capability catalogue and server authorisation**

1. Given the platform, when `GET /api/organisation/capabilities` is called by any member, then it lists exactly: `ManageEvents`, `ViewAttendees`, `ManageAttendance`, `KeepContacts`, `ViewPartners`, `ManagePartners`, `InviteMembers`, `ConnectLink`, `OwnWorkspaces`, `JoinWorkspaces`, `ReadAllWorkspaces`, `ViewPeopleDirectory`, `AssignRoles`, `SendAnnouncements`, `AddResources`, `ViewReports`, `ManageRoles`, `ManageOrganisationSettings`, `AdministerOrganisation`, each with a one-line description, and no organisation can add, rename or remove one.
2. Given a request, when the server authorises it, then it checks the caller's capabilities, computed on that request from the union of the capabilities of every non-archived role the caller's profile holds in the current organisation, and never compares a role name.
3. Given a holder of `AdministerOrganisation`, when any capability is checked, then it is held.
4. Given an action that needs a capability the caller lacks, when it is called, then the response is 403 (or 404 where `L2-042` AC2 hides existence), and nothing changes.
5. Given an action the caller is allowed only because they hold `AdministerOrganisation` (they lack the specific capability, or do not own the record), when it succeeds, then it is an override and an audit entry is written (`L2-041`); given the caller holds the specific capability or owns the record, then it is not audited (role changes excepted, `L2-138` AC5).
6. Given every signed-in member of the organisation, when they view profiles, the team, events and announcements, RSVP, open resources and notes visible to them, create their own notes, search, or edit their own profile and settings, then no capability is required.
7. Given the frontend, when it decides what to show, then it reads capabilities from `/api/me`, never role names, and hiding is a convenience only: the server refuses what the member may not do.

**`L2-139` — Last administrator and consequences of role changes**

1. Given an organisation, when a role removal, a profile suspension, a definition edit or a definition archive would leave no active, unsuspended profile holding `AdministerOrganisation`, then it is refused with 409 "There must always be at least one administrator." and nothing changes, is audited or is notified.
2. Given two such requests that overlap, when both settle, then at most one succeeds: each takes the organisation's administrator-roster lease in a save of its own before counting, and the loser answers 409 "Someone else changed administrator roles at the same time. Reload and try again."; a lease left behind expires after 30 seconds.
3. Given a profile loses a capability (its role was removed, or its definition lost the capability) and no other role it holds still gives it, when the change is saved, then a `CapabilityLost(profile, capability)` domain event is raised in the same unit of work.
4. Given `CapabilityLost` for `OwnWorkspaces` on a profile that owns workspaces, when it is handled, then every administrator is notified (`WorkspaceOwnerLostCapability`, "{Name} no longer holds a role that can own workspaces: {workspace list}") so they can reassign the owner (`L2-037` AC2); the workspace keeps working meanwhile.
5. Given `CapabilityLost` for `ConnectLink`, when it is handled, then the profile's connect link answers as unknown until the capability is held again (`L2-082` AC3).
6. Given a definition gains a capability, when the change is saved, then every holder has it on their next request, and nothing is notified.

## Diagrams

### System context

The owner archives and restores; an administrator archives, restores and reassigns ownership. Notifications reach administrators by email as well as in-app.

![C4 system context for archiving and transferring workspaces](diagrams/c4-context.png)

### Containers

The Web app calls the Community API, which updates archive flags and ownership in PostgreSQL and sends email through the provider from its outbox.

![C4 container view for archiving and transferring workspaces](diagrams/c4-container.png)

### Components

`ArchiveHandler` authorizes through `WorkspaceAccessPolicy` and audits only `AdministerOrganisation` overrides and owner reassignment; `CapabilityLostHandler`, called by `ChangeRolesHandler`, notifies every administrator through `AgileNotifier`, and `WorkspacesHandler.ListAsync` feeds the admin users alert.

![C4 component view for archiving and transferring workspaces](diagrams/c4-component.png)

### Class structure

`Workspace` and `WorkItem` expose `Archive` and `Restore`; `ArchiveHandler` serves every archive, restore and ownership route, and `CapabilityLostHandler` handles the `CapabilityLost` event for `OwnWorkspaces`.

![Class diagram for archiving and transferring workspaces](diagrams/class-structure.png)

### Behaviour — archive and restore a workspace

`ArchiveHandler` flips `IsArchived`; the query filter then hides the workspace from members and Readers, while the owner or an administrator restores it from the Archived list (`L2-037`). Only an `AdministerOrganisation` override is audited. Items follow the same flow through `/api/items/{id}/archive`.

![Sequence diagram: archive and restore a workspace](diagrams/sequence-archive-restore.png)

### Behaviour — reassign ownership after role loss

An owner losing `OwnWorkspaces` notifies every administrator in-app and by email; an administrator opens the workspace settings and reassigns it to another holder of `OwnWorkspaces`, and the action is always audited (`L2-037`, `L2-139`).

![Sequence diagram: reassign ownership after role loss](diagrams/sequence-reassign-owner.png)

## Open questions

Decisions recorded while building the feature:

- `WorkItem.Archive(items, archivedById, now)` archives the item and everything under it among `items`, so a story takes its tasks and an epic its stories and their tasks (`L2-037` AC1). `Restore(items)` brings back only what was archived at the same moment; an item archived earlier stays archived. Settings lists an archived item only when its parent is not archived.
- `Workspace.Archive()` and `Restore()` set only `IsArchived`; who archived a workspace and when is not recorded, unlike a work item's `ArchivedById` and `ArchivedAt`.
- Archive and restore reject an item or workspace already in the target state. Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
- Archive, restore and ownership share one `ArchiveHandler`; `ReassignOwnerCommand` is the only request record. There are no separate archive or restore command types.
- Audit follows ADR 0011: an owner's archive or restore is not audited, an administrator's is (`AuditOverride`), and `ReassignOwnerAsync` needs `AdministerOrganisation` and is always audited (`workspace.owner.reassigned`).
- An archived workspace is listed only to its owner and administrators and answers 404 to everyone else. It is not flagged `needsNewOwner` and no administrator is notified about it until it is restored: `CapabilityLostHandler` reads the filtered `db.Workspaces` and `ListAsync` flags live workspaces only.
- When an owner loses `OwnWorkspaces`, every non-suspended administrator gets an in-app notification and an email (`AgileNotifier.Notify` then `SendEmailsAsync`, driven by `ChangeRolesHandler`), each linking to `/workspaces/{id}/settings`; there is no `INotificationService`.
- Reassignment happens from workspace settings through `ReassignOwnerDialog`, reached from the notification and from the admin users alert, so the `admin` library never depends on the `agile` library.
- Capabilities: `CityLeadRoleRemoved` and its handler become `CapabilityLost` and `CapabilityLostHandler`, reacting to `OwnWorkspaces` whether a role was removed or its definition edited; the notification kind becomes `WorkspaceOwnerLostCapability`; the owner candidate rule, `NeedsNewOwner` and `ReassignOwner` test the profile's current capabilities instead of a role name (ADR 0033, `L2-139`).
