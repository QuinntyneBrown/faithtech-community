# 0008. Workspace access, audit and ownership

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-026 AC2, L2-031, L2-037, L2-041 AC1, L2-042, L2-050, L2-051
- Designs: `docs/detailed-designs/agile/workspaces-and-membership`, `docs/detailed-designs/agile/archive-and-transfer-workspaces`

## Context

Every Agile handler must decide who may read and change a workspace. The designs name a shared `WorkspaceAccessPolicy` but leave open when a System Admin's action is audited, what an archived workspace looks like to each role, where System Admin reassigns an owner, and how the admin users page learns that a workspace needs a new owner.

## Decision

- `WorkspaceAccessPolicy` classifies the caller for one workspace, in this order: **Owner** (`Workspace.OwnerId`), **Member** (a `WorkspaceMember` row), **Admin** (holds System Admin), **Staff** (holds Staff), else **Outsider**. A System Admin who owns or belongs to the workspace is classified as owner or member.
- Reads: owner, member, Admin and Staff may read; an outsider gets `404` for the workspace and everything in it (L2-042 AC2). Lists filter in the database query.
- Member writes (stories, tasks, comments, card moves, adding stories to a sprint, Planning Poker): owner, member and Admin. Owner writes (initiatives and epics, rename, members, sprints, switch method, archive and restore): owner and Admin. Everyone else who can read gets `403`.
- An Admin write is an override and is audited with the action, the workspace or item, and before and after values (ADR 0004 pattern). A System Admin acting as owner or member is not an override and is not audited. Actions are named `workspace.*`, `workitem.*`, `sprint.*` and `poker.*`.
- An archived workspace answers `404` to members and Staff and disappears from their lists. The owner and System Admin still list it (with an Archived badge and *Restore*) so it "can be restored from Workspaces"; every other request for it is `404` until it is restored. Archived work items are hidden from the backlog, board and search; the owner and System Admin see them in workspace settings with *Restore*.
- Workspace owner reassignment is System Admin only, and happens from workspace settings through `ReassignOwnerDialog`. Removing the City Lead role from an owner notifies every System Admin in-app (`WorkspaceOwnerLostCityLead`, linking to that workspace's settings) in the same unit of work as the role change. `GET /api/workspaces` marks such workspaces `needsNewOwner`; the admin users page shows the mock's "A workspace needs a new owner" alert and links each to its settings, so the admin library never depends on the agile library.
- The new owner must hold City Lead (`Workspace.ReassignOwner`) and becomes a member; the former owner stays a member so their items keep their assignee.
- Added members, assignees and Planning Poker invitees get an in-app notification and an email (L2-028), sent through the email outbox after the change is saved. Nobody is notified about their own action.

## Consequences

- One policy answers every Agile endpoint and the SignalR hub, so the 404/403 rules cannot drift between features.
- Search (L2-026 AC2) must apply the same member, Staff or System Admin filter when work items are indexed; global search is not built yet, so this is recorded as deferred in the agile designs.
