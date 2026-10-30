# Assign roles

## Overview

The Community platform grants permissions through *roles*. A **role** — organisation-owned named bundle of capabilities held by a profile (`docs/detailed-designs/organisations/role-definitions-and-grant-rules`). The roles are the organisation's non-archived role definitions, each carrying a set of capabilities from the platform catalogue (`L2-135`). A profile may hold any combination of them, each assignment optionally tagged with a {chapter} when its definition is chapter-scopable, and a new profile holds none.

This feature covers adding and removing roles on a profile. Who may grant what is the organisation's data. A holder of `AssignRoles` may add or remove the roles that a grant rule lets one of their roles grant (`L2-137`, `L2-138`), within their chapter scope when their grantor role is chapter-tagged (`L2-143`). A holder of `AdministerOrganisation` may grant or remove any role without a rule, and a role carrying `AdministerOrganisation` can be granted only by one. Every role change is audited, and the profile owner is notified when the actor is not acting as an administrator. The last active, unsuspended holder of a role carrying `AdministerOrganisation` can never lose it, so the organisation always keeps an administrator (`L2-139`). The FaithTech seed reproduces the former fixed limits as data (seeded as City Lead and System Admin in FaithTech, `L2-151`).

The feature sits in the admin subsystem because role grants are the root of every other permission check. The add-role and remove-role dialogs open from a profile page.

## Description

The slice runs from the profile page in the web app to the `ProfileRole` rows in the Community database. Every query is scoped by the DbContext's global filter on `ICurrentOrganisation`.

- **`RoleDialogComponent`** — presentational Angular CDK dialog in the `components` library with an `add` and a `remove` mode (ADR 0005). It receives the person's name, a description, the role options, the optional {chapter} options and a `submit(value)` callback through `DIALOG_DATA`. In `remove` mode with a single removable role it shows no radio group, since the title already names the role; with several it shows the group. In `add` mode it shows a {chapter} picker when the chosen role is chapter-scopable and chapters are on (`L2-138` AC6), required when the caller's scope demands one (`L2-143` AC1). It owns the invalid ("Choose a role to add."), busy and failed states, and closes with the chosen role once `submit` resolves to `null`. A message from `submit`, such as a `403` or `409` reason, shows inside the dialog.
- **`ProfilePage`** — page in the `profiles` library that opens `RoleDialogComponent` with `DialogService`. It offers only the roles whose ids are in `grantableRoleIds` from `/api/me` (`L2-137` AC5), named from `GET /api/organisation`, and passes a `submit` that calls `ROLES_SERVICE` and replaces the profile's roles with the returned set, so the badges update without a page reload. The `admin` library does not open the dialog; the admin users page links to the profile.
- **`RolesService`** / **`ROLES_SERVICE`** / **`HttpRolesService`** — API client contract, injection token and HTTP implementation in the `api` library. They call `POST /api/profiles/{id}/roles` `{ roleId, chapterId? }` and `DELETE /api/profiles/{id}/roles/{roleId}`. Requests carry the `HANDLES_FORBIDDEN` `HttpContextToken`, so a `403` reaches the dialog instead of the global `/forbidden` redirect.
- **`grantableRoleIds`** and **`capabilities`** on `/api/me` — the server computes which definitions the caller's rules allow and the frontend only hides what the server would refuse (`L2-135` AC7). `role.ts` in the `api` library no longer holds `assignableRoles`, `ROLE_LABELS` or `ROLE_DESCRIPTIONS`; names and descriptions come from `GET /api/organisation` (ADR 0033).
- **`RolesEndpoints`** — minimal API mapping in `FaithTech.Community.Api`. It authenticates the caller and calls the handler; it holds no business logic. Both routes return the profile's new role set.
- **`AssignRoleCommand`** (`RoleId`, `ChapterId?`) — request body of the add route. The profile id and, for removal, the role id come from the route.
- **`ChangeRolesHandler`** — Application handler in `Admin/` with `AssignAsync(profileId, roleId, chapterId)` and `RemoveAsync(profileId, roleId)`. It asks `RoleGrantPolicy` whether the caller may change the role, applies the change to `Profile`, records an audit entry for every change and, when the caller is not acting as an administrator, notifies the profile owner through `RoleChangeNotifier`. It resolves the caller's profile id, used as the actor, through `ProfileAccess.CallerProfileIdAsync`. On removal it asks `CapabilityLossDetector` which capabilities the profile no longer holds and raises `CapabilityLost` for each (`L2-139` AC3).
- **`RoleGrantPolicy`** — concrete Application class over the organisation's `RoleGrantRule` rows and the caller's held assignments (role-definitions design). `CanChangeRoles` is true for a holder of `AssignRoles` with at least one active rule, or of `AdministerOrganisation`; `CanChange(definition, chapterId)` allows an administrator any role, and otherwise requires a rule from one of the caller's roles to the definition, refuses a definition carrying `AdministerOrganisation`, and applies chapter scoping when the caller's grantor assignment is chapter-tagged (`L2-143`); `GrantableRoleIds` is what `/api/me` returns; `NotifiesOwner` is true when the caller lacks `AdministerOrganisation` (`L2-138` AC3). The last-administrator check is `LastAdministratorGuard`, not a policy method.
- **`OrganisationAdminRoster`** — Domain entity (`Organisations/`) with one row per organisation, which serializes removals of a role carrying `AdministerOrganisation` so overlapping requests cannot both pass the count and leave no administrator. A removal first takes the roster's lease (`TryTake`) in a save of its own. `Version` is an optimistic concurrency token, so when two removals overlap only one save succeeds, and the other gets `409` "Someone else changed administrator roles at the same time. Reload and try again." with nothing changed, audited or notified. The lease holder counts the active, unsuspended administrators, returns "There must always be at least one administrator." when only one is left, and otherwise removes the role, audits it and releases the lease in one save (`L2-139` AC1, AC2). A lease left behind by a request that failed expires after 30 seconds. In PostgreSQL the concurrency token is checked by the `UPDATE ... WHERE "Version" = @original` of each save inside its transaction. The migration inserts the row for each organisation, and provisioning (`L2-149`) and `CommunitySeeder` add it if it is missing. The behaviour is tested by overlapping two requests at the save with a test-only EF interceptor on the in-memory provider.
- **`RoleDefinition`** — Domain entity (`Organisations/`) referenced by each assignment: name, capabilities, `ChapterScopable` and archived flag. **`Profile`** — Domain entity that owns a set of `ProfileRole` entries (definition id, optional chapter id, who granted it, when) and enforces no duplicates: `AddRole(roleId, chapterId, grantedBy, nowUtc)` rejects an assignment already held with the same chapter tag and `RemoveRole(roleId)` rejects one not held. A removal that takes away a capability no remaining role still gives raises the **`CapabilityLost`** domain event in `Profile.DomainEvents`; the Agile handler reacts to `OwnWorkspaces` (`L2-139` AC4, `L2-037`).
- **`ICurrentUser`** — caller user id, held roles and capabilities, computed on every request from the profile's current roles in `ICurrentOrganisation` (`L2-135` AC2).
- **`IAuditLog`** — `Record(actorId, action, targetType, targetId, before, after)` adds an entry with the before and after role sets and the chapter tag; `AuditLog` stamps the UTC time and IP address (`L2-041`, `L2-138` AC5).
- **`RoleChangeNotifier`** — Application service. `Notify(ownerProfileId, title)` adds an in-app `Notification` (`RoleChanged`) to the unit of work; `QueueEmailAsync(ownerProfileId, title)` queues the owner's email through `IEmailQueue` in the same unit of work, so the role change, its notification and its email are saved together.
- **`RoleLabels`** — Application helper that reads each definition's name for notification titles and audit summaries.
- **`GrantSystemAdminAsync`** — `CommunitySeeder` method behind the Cli `grant-admin <email>` command. It grants the first role carrying `AdministerOrganisation` in the seeded organisation and writes a `role.granted` entry with an empty actor id and IP address `cli`. A provisioned organisation gets its first administrator through the pre-assigned invite instead (`L2-149` AC2).

The visible role options in the dialog are a convenience; the server returns `403` for any change the caller is not permitted to make.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-008` | `L1-003` | Multiple global roles |
| `L2-009` | `L1-003` | Role assignment limits |
| `L2-138` | `L1-003`, `L1-026` | Assigning roles under grant rules |
| `L2-139` | `L1-026`, `L1-014` | Last administrator and consequences of role changes |

### Acceptance criteria

**`L2-008` — Multiple global roles**

1. Given a profile, when roles are assigned, then it can hold any combination of the organisation's roles at once, each assignment optionally tagged with a {chapter} when its definition is chapter-scopable (`L2-141` AC3), and no tag limits what the holder may see (`L2-142`).
2. Given a new profile, when it is created, then it holds no role.

**`L2-009` — Role assignment limits**

1. Given a holder of `AssignRoles`, when they add or remove a role that a grant rule lets one of their roles grant, on any profile in the organisation, then the change succeeds and the profile owner is notified (`L2-138` AC1).
2. Given a holder of `AssignRoles`, when they try to grant or remove a role that no grant rule lets them grant, then the option is not shown and the API returns 403 (`L2-138` AC2).
3. Given a holder of `AdministerOrganisation`, when they grant or remove any role, then the change succeeds without a rule and an audit entry is written (`L2-138` AC3, AC5).
4. Given a member without `AssignRoles` or `AdministerOrganisation`, when they try to change roles through the API, then the response is 403 (`L2-138` AC4).
5. Given a removal, when the add-role or remove-role dialog is confirmed, then the profile's roles update without a page reload.
6. Given the last active, unsuspended holder of a role carrying `AdministerOrganisation`, when anyone tries to remove that role, then the change is refused (`L2-139` AC1).

**`L2-138` — Assigning roles under grant rules**

1. Given a holder of `AssignRoles`, when they add or remove a role that a grant rule lets one of their roles grant, on any profile in the organisation, then `POST /api/profiles/{id}/roles` `{ roleId, chapterId? }` or `DELETE /api/profiles/{id}/roles/{roleId}` succeeds, the profile's roles update without a page reload, and the profile owner is notified in-app and by email ("{Actor} made you {role}" / "removed {role}") unless the actor changed their own profile.
2. Given a holder of `AssignRoles`, when they try to add or remove a role no rule lets them grant, then the option is not shown and the API answers 403.
3. Given a holder of `AdministerOrganisation`, when they add or remove any role, then the change succeeds; the owner is not notified when the actor acts as administrator.
4. Given a member without `AssignRoles` or `AdministerOrganisation`, when they call either endpoint, then the response is 403.
5. Given any role change, by anyone, when it succeeds, then an audit entry `role.granted` or `role.removed` records the actor, the profile, the role, the chapter tag and the before and after role sets (`L2-041`).
6. Given a role whose definition is chapter-scopable and chapters are on, when the add-role dialog shows it, then a {chapter} picker (optional unless `L2-143` requires one) tags the assignment; a chapter on a non-scopable role answers 400.
7. Given a role id that is archived or belongs to another organisation, when it is assigned, then the API answers 400 "Choose a role."; adding a role already held with the same chapter tag, or removing one not held, answers 409.
8. Given the last holder of a role with `AdministerOrganisation`, when anyone tries to remove it, then the change is refused with 409 "There must always be at least one administrator." (`L2-139` AC1).

**`L2-139` — Last administrator and consequences of role changes**

1. Given an organisation, when a role removal, a profile suspension, a definition edit or a definition archive would leave no active, unsuspended profile holding `AdministerOrganisation`, then it is refused with 409 "There must always be at least one administrator." and nothing changes, is audited or is notified.
2. Given two such requests that overlap, when both settle, then at most one succeeds: each takes the organisation's administrator-roster lease in a save of its own before counting, and the loser answers 409 "Someone else changed administrator roles at the same time. Reload and try again."; a lease left behind expires after 30 seconds.
3. Given a profile loses a capability (its role was removed, or its definition lost the capability) and no other role it holds still gives it, when the change is saved, then a `CapabilityLost(profile, capability)` domain event is raised in the same unit of work.
4. Given `CapabilityLost` for `OwnWorkspaces` on a profile that owns workspaces, when it is handled, then every administrator is notified (`WorkspaceOwnerLostCapability`, "{Name} no longer holds a role that can own workspaces: {workspace list}") so they can reassign the owner (`L2-037` AC2); the workspace keeps working meanwhile.
5. Given `CapabilityLost` for `ConnectLink`, when it is handled, then the profile's connect link answers as unknown until the capability is held again (`L2-082` AC3).
6. Given a definition gains a capability, when the change is saved, then every holder has it on their next request, and nothing is notified.

## Diagrams

### System context

Holders of `AssignRoles` and administrators change roles on member profiles through the Community platform. The platform notifies the affected member by email through the email provider.

![C4 system context for assign roles](diagrams/c4-context.png)

### Containers

The `profiles` feature library in the Angular web app opens the role dialog from `components` and calls the Community API through the `api` library over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database and sends email through the email provider.

![C4 container view for assign roles](diagrams/c4-container.png)

### Components

`ProfilePage` opens `RoleDialogComponent`; its `submit` callback calls `HttpRolesService`, which reaches `RolesEndpoints`. `ChangeRolesHandler` consults `RoleGrantPolicy`, mutates the `Profile`, records the audit entry, adds the owner's notification, saves through `CommunityDbContext` and then emails the owner.

![C4 component view for assign roles](diagrams/c4-component.png)

### Class structure

`Profile` composes zero or more `ProfileRole` entries, each referencing a `RoleDefinition` and an optional chapter. `ChangeRolesHandler` depends on `RoleGrantPolicy`, `ProfileAccess`, `IAuditLog`, `RoleChangeNotifier` and `LastAdministratorGuard`; the policy reads `ICurrentUser` and the organisation's `RoleGrantRule` rows under `ICurrentOrganisation`.

![Class diagram for assign roles](diagrams/class-structure.png)

### Behaviour — add a role

`ChangeRolesHandler.AssignAsync` checks the grant rules and chapter scope (`L2-138`, `L2-143`) before any write. A permitted change is persisted and audited and, for a caller not acting as an administrator, notified to the owner; a forbidden change returns `403` with no state change.

![Sequence diagram for add a role](diagrams/sequence-add-role.png)

### Behaviour — remove a role

`ChangeRolesHandler.RemoveAsync` follows the same checks, takes the administrator-roster lease when the role carries `AdministerOrganisation`, refuses removal of the last administrator with `409` (`L2-139` AC1) and raises `CapabilityLost` for each capability the profile no longer holds (`L2-139` AC3).

![Sequence diagram for remove a role](diagrams/sequence-remove-role.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- Role count: `L2-008` listed nine roles and the Domain `Role` enumeration held exactly those nine. The earlier single `Lead` value was replaced by four lead roles (seeded as City Lead, Event Lead, Create Lead and Communications Lead in FaithTech). Resolved.
- Roles persist as `ProfileRole` rows (table `ProfileRoles`, key profile and role), replacing the earlier text-array column.
- Domain events: `Profile` collects `CityLeadRoleRemoved` in `DomainEvents`; the handler that saves the profile dispatches and clears them. `ChangeRolesHandler` clears them without dispatching in v1, because the workspace handler for `CityLeadRoleRemoved` belongs to the deferred Agile design. A shared domain-event base type is deferred until a second aggregate raises events.
- Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
- Responses: both routes return the profile's new role set. A role id that is archived or belongs to another organisation answers `400` "Choose a role." Adding a role already held with the same chapter tag, or removing one not held, answers `409`. Removing the last administrator answers `409` "There must always be at least one administrator." An unknown profile answers `404` to a caller who may change roles and `403` to anyone else.
- Every role change is audited (`role.granted`, `role.removed`), whoever makes it; the owner is notified only when the caller is not acting as an administrator, and not when that caller changes their own profile. The in-app notification is saved with the change; the email is sent after the save.
- A caller changing roles through the profile page is shown "Add a role" and "Remove a role" only when `grantableRoleIds` offers at least one option.
- Capabilities: the `Role` enumeration, `RoleAssignmentPolicy`, `CityLeadRoles`, `SystemAdminRoster` and `CityLeadRoleRemoved` are replaced by `RoleDefinition`, `RoleGrantPolicy`, `RoleGrantRule`, `OrganisationAdminRoster` and `CapabilityLost`; the routes take a role id and an optional chapter id (ADR 0033, ADR 0034).
