# Admin users page and override

## Overview

A holder of `AdministerOrganisation` (seeded as System Admin in FaithTech) holds **full override** — authority to view or change any record in the organisation, including records otherwise restricted to their owner, such as private contacts and Agile workspaces. This feature provides the admin users page, where an administrator searches every member of the organisation and sees each member's roles, with any {chapter} tags, and status, and defines how override is applied across the rest of the system.

Override is not a separate set of screens. Each feature's Application permission check treats `AdministerOrganisation` as permitted through `ICurrentUser.Has(capability)` (`L2-135` AC3), and `AuthorizationRules.IsOverride` tells the handler when the grant was by override: the caller lacks the specific capability or does not own the record. Each override is written to the audit log (`L2-135` AC5, `L2-041`). This document describes the override rule and the admin users page; the feature designs that own each record type apply the rule (`docs/detailed-designs/organisations/capabilities-and-authorization`).

## Description

Every query is scoped by the DbContext's global filter on `ICurrentOrganisation`, so the admin users page lists the members of the current organisation only.

- **`AdminUsersPage`** — page in the `admin` feature library at `/admin/users`. It shows a search box and a list of members with name, email, roles (each with its {chapter} tag when it has one) and status (Active, Suspended, Unverified), 25 at a time with a **Show more users** button. The name links to the profile, where the role dialog opens (`admin/assign-roles`); the row action suspends or reinstates (`admin/suspend-users`). `ListSkeletonComponent` from `components` shows the loading state. At XS widths the table scrolls inside its card. Each search starts a new request generation; a first page, a *Show more users* page or a failure that belongs to an older search is dropped, so a slow earlier answer never replaces or extends the newest results (as `TeamPage` does).
- **`AdminUsersService`** / **`ADMIN_USERS_SERVICE`** / **`HttpAdminUsersService`** — API client in the `api` library calling `GET /api/admin/users?q=&page=`. Its requests carry the `HANDLES_FORBIDDEN` `HttpContextToken`, so a `403` reaches the page, which shows its own forbidden state instead of the global `/forbidden` redirect.
- **`AdminUsersEndpoints`** — minimal API mapping for the query. A `null` result from the handler answers `403`.
- **`SearchUsersHandler`** in Application `Admin/` — `HandleAsync(term, page)` requires `AdministerOrganisation` and returns a `PagedResult<AdminUserSummary>`, or `null` for any other caller. Page size: 25, ordered by name. Search matches name or email, case-insensitive, and includes suspended members. Status is Suspended when the profile is suspended, Unverified when the email is not confirmed, and Active otherwise.
- **Override** — not a shared class. Each feature's own access check grants `AdministerOrganisation` and tells its handler that the grant was by override, using `AuthorizationRules.IsOverride(actor, capability)` and ownership. For profiles this is `ProfileAccess.AuthorizeEditAsync` (ADR 0004): it answers `EditAccess.Owner`, `EditAccess.AdminOverride` or `EditAccess.Forbidden`, and the profile handlers write an audit entry only for `AdminOverride`. Contacts and the Agile workspaces apply the same rule in their own designs.
- **Edit another member's profile** — the built override screen. `ProfilePage` shows *Edit profile* whenever `ProfileDto.CanEdit` is true (owner or administrator), linking to `/people/me/edit` on the caller's own profile and to `/people/{id}/edit` on anyone else's. `EditProfilePage` takes the route's `id` (`me` by default) and loads, saves and changes photos for that profile. For another member it is titled "Edit {name}’s profile", says "You’re editing as an administrator. Every change is recorded in the audit log.", names the member in the breadcrumb and Cancel returns to their profile (`profile/admin`, `edit-profile/admin` mocks). When `CanEdit` is false it shows the forbidden state "You can only edit your own profile" with *Back to profile* and no form (`edit-profile/forbidden` mock); the API refuses any change regardless (ADR 0004).
- **`IAuditLog`** — `Record(actorId, action, targetType, targetId, before, after)` adds the override entry to the same unit of work as the change.

Whether read-only override views (for example, reading a private contact) are audited per request or per session: per request, as `L2-012` AC2 requires for contacts.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-040` | `L1-014` | Admin users page and override |
| `L2-135` | `L1-026`, `L1-015` | Capability catalogue and server authorisation |

### Acceptance criteria

**`L2-040` — Admin users page and override**

1. Given a holder of `AdministerOrganisation`, when they open admin users, then they can search every member of the organisation and see each member's roles, with any {chapter} tags, and status.
2. Given a holder of `AdministerOrganisation`, when they view or change any record in the organisation, including private contacts and workspaces, then the action succeeds; where they lack the specific capability or do not own the record it is an override and is audited (`L2-135` AC5).
3. Given a holder of `AdministerOrganisation` viewing another member's profile, when they choose "Edit profile", then the editor opens at `/people/{id}/edit` for that member, not their own, and saving changes that member's details and photos, with each change audited (L2-041 AC1).
4. Given a user without `AdministerOrganisation`, when they open another member's editor at `/people/{id}/edit`, then a forbidden state is shown with no form, and the API refuses any change (L2-006 AC3).

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

The administrator is the only actor. Override applies inside the Community platform; no external system participates.

![C4 system context for admin users page and override](diagrams/c4-context.png)

### Containers

The `admin` and `profiles` feature libraries in the Angular web app call the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for admin users page and override](diagrams/c4-container.png)

### Components

`SearchUsersHandler` serves the admin users page. Each feature handler asks its own access check, such as `ProfileAccess`, and writes to `AuditLog` when access is by override.

![C4 component view for admin users page and override](diagrams/c4-component.png)

### Class structure

`SearchUsersHandler` checks `ICurrentUser.Has(AdministerOrganisation)` and returns `AdminUserSummary` items, whose `Status` is a `UserStatus` name. `ProfileAccess` is the built example of the override rule: it returns `EditAccess` using `AuthorizationRules.IsOverride`, and the profile handlers call `IAuditLog` for `AdminOverride`. Every query runs under `ICurrentOrganisation`.

![Class diagram for admin users page and override](diagrams/class-structure.png)

### Behaviour — search users

The handler requires `AdministerOrganisation` and returns a page of members with roles and status (`L2-040` AC1).

![Sequence diagram for search users](diagrams/sequence-search-users.png)

### Behaviour — override access to an owned record

Any feature handler that receives a request for a record the caller does not own asks its feature's access check. A holder of `AdministerOrganisation` is granted access as `AdminOverride` and an audit entry is written (`L2-040` AC2, `L2-135` AC5). The diagram uses the profile edit as the built example.

![Sequence diagram for override access to an owned record](diagrams/sequence-override-access.png)

## Open questions

Decisions recorded while implementing:

- Users are addressed by **profile id** in every admin route (`/api/admin/users/{profileId}/...`); the handler resolves the account from `Profile.UserId`. `AdminUserSummary` is `Id` (profile id), `Name`, `Email`, `Roles`, `Status`.
- The Admin tab row is Users and Audit log only. The mock once had a "Roles" tab linking to the People page (`L2-053`, built with the profiles feature), a page without the same tab row; it was removed so every tab leads to a page with the same tab set. Administrators assign roles from People, reached from the top bar. The workspace-owner alert in the mock belongs to the Agile design and is deferred with it.
- A caller without `AdministerOrganisation` opening `/admin/**` gets the API's `403` and the page shows the forbidden state ("This area is for administrators").
- The shell shows the **Admin** navigation link only to holders of `AdministerOrganisation` (`L2-045` AC4).
- The profile override needed a route: `/people/:id/edit` reuses `EditProfilePage` rather than a separate admin editor, so validation, photos and toasts stay one implementation. `ProfilePage` decides from `CanEdit`, not from the caller's roles, so the server stays the authority. Resolved.
- Capabilities: the override rule is now `AuthorizationRules.IsOverride` over `AdministerOrganisation`, and the admin users list is scoped to the current organisation; the former `CommunityUser.ProfileId` link is replaced by `Profile.UserId` with one profile per organisation (ADR 0032, ADR 0033).
