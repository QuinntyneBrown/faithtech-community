# Archive and transfer workspaces

## Overview

Workspaces and work items are never hard-deleted by their owners; they are archived.

> **archive** — soft delete that hides a workspace or work item from normal views while keeping it restorable
>
> **ownership transfer** — System Admin reassignment of a workspace to another City Lead

The workspace owner archives a workspace or an item and may restore it; System Admin may also restore it. When an owner loses the City Lead role (see the role assignment feature), the system notifies System Admin, who reassigns ownership to another City Lead. Each System Admin action is written to the audit log.

## Description

- **`WorkspaceSettingsPage`** — owner actions for archive and restore of the workspace and archived items (mock `docs/mocks/pages/workspace-settings`).
- **`ArchiveWorkspaceDialog`** and **`ArchiveWorkItemDialog`** — CDK Dialogs confirming the archive (mocks `archive-workspace`, `archive-work-item`).
- **`ReassignOwnerDialog`** — CDK Dialog for System Admin to pick a new City Lead owner (mock `docs/mocks/dialogs/reassign-owner`). Where System Admin opens it (admin library or workspace settings) is `<TO SUPPLY>`.
- **`AgileService`** — `api` contract (`AGILE_SERVICE`, `HttpAgileService`).
- **`WorkspacesEndpoints`** — maps `POST /workspaces/{id}/archive`, `/restore`, `/owner`, and `POST /items/{id}/archive`, `/restore`.
- **`ArchiveWorkspaceCommand`**, **`RestoreWorkspaceCommand`**, **`ArchiveWorkItemCommand`**, **`RestoreWorkItemCommand`** and handlers — set or clear `IsArchived`; a global EF query filter hides archived rows from normal views.
- **`ReassignWorkspaceOwnerCommand`** / **`ReassignWorkspaceOwnerHandler`** — System Admin only; `Workspace.ReassignOwner(newOwner)` rejects a profile without the City Lead role.
- **`CityLeadRoleRemovedHandler`** — Application handler for the `CityLeadRoleRemoved` domain event that `Profile.RemoveRole` raises when the City Lead role is removed; it notifies System Admin of each workspace the former owner holds.
- **`WorkspaceAccessPolicy`** — Application service shared by every agile handler. It resolves the caller from `ICurrentUser` and classifies the caller as owner, member, Staff, System Admin or outsider for a workspace. Outsiders receive 404, Staff and non-owner members receive 403 on writes they lack, and System Admin actions pass and are written to the audit log (`L2-031`, `L2-042`).
- **`IAuditLog`** and **`INotificationService`** — audit and notification abstractions.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-037` | `L1-012` | Archive and ownership of workspaces |

### Acceptance criteria

**`L2-037` — Archive and ownership of workspaces**

1. Given the owner, when they archive a workspace or an item, then it is hidden from normal views and can be restored by the owner or a System Admin. Archiving a story also archives its tasks.
2. Given an owner who loses the City Lead role, when the role is removed, then System Admin is notified and can reassign ownership to another City Lead.
3. Given a member who is not the owner, when they view an item, then no Archive action is shown.

## Diagrams

### System context

The owner archives and restores; System Admin restores and reassigns ownership. Notifications reach System Admin by email as well as in-app.

![C4 system context for archiving and transferring workspaces](diagrams/c4-context.png)

### Containers

The Web app calls the Community API, which updates archive flags and ownership in PostgreSQL and sends email through the provider.

![C4 container view for archiving and transferring workspaces](diagrams/c4-container.png)

### Components

Archive and reassign handlers check access and audit System Admin actions; `CityLeadRoleRemovedHandler` notifies System Admin.

![C4 component view for archiving and transferring workspaces](diagrams/c4-component.png)

### Class structure

`Workspace` and `WorkItem` expose `Archive` and `Restore`; `CityLeadRoleRemovedHandler` handles the `CityLeadRoleRemoved` event.

![Class diagram for archiving and transferring workspaces](diagrams/class-structure.png)

### Behaviour — archive and restore a workspace

Archiving hides the workspace from normal views; the owner or System Admin restores it (`L2-037`). Items follow the same flow through `/items/{id}/archive`.

![Sequence diagram: archive and restore a workspace](diagrams/sequence-archive-restore.png)

### Behaviour — reassign ownership after role loss

Removing the City Lead role from an owner notifies System Admin, who reassigns the workspace to another City Lead; the action is audited (`L2-037`).

![Sequence diagram: reassign ownership after role loss](diagrams/sequence-reassign-owner.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `WorkItem.Archive(children)` and `Restore(children)` also archive or restore the tasks of a story (`L2-037` AC1); the handler passes the loaded children.
- Archive and restore reject an item or workspace already in the target state. Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
