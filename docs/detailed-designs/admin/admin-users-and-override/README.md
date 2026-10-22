# Admin users page and override

## Overview

A System Admin holds **full override** — authority to view or change any record in FaithTech Community, including records otherwise restricted to their owner, such as private contacts and Agile workspaces. This feature provides the admin users page, where a System Admin searches every account and sees each user's roles and status, and defines how override is applied across the rest of the system.

Override is not a separate set of screens. Each feature's Application permission check treats System Admin as permitted, and each overriding access is written to the audit log (`L2-041`). This document describes the override rule and the admin users page; the feature designs that own each record type apply the rule.

## Description

- **`AdminUsersPage`** — page in the `admin` feature library at `/admin/users`. It shows a search box and a list of users with name, email, roles and status (Active, Suspended, Unverified), 25 at a time with a **Show more users** button. The name links to the profile, where the role dialog opens (`admin/assign-roles`); the row action suspends or reinstates (`admin/suspend-users`). `ListSkeletonComponent` from `components` shows the loading state. At XS widths the table scrolls inside its card. Each search starts a new request generation; a first page, a *Show more users* page or a failure that belongs to an older search is dropped, so a slow earlier answer never replaces or extends the newest results (as `TeamPage` does).
- **`AdminUsersService`** / **`ADMIN_USERS_SERVICE`** / **`HttpAdminUsersService`** — API client in the `api` library calling `GET /api/admin/users?q=&page=`. Its requests carry the `HANDLES_FORBIDDEN` `HttpContextToken`, so a `403` reaches the page, which shows its own forbidden state instead of the global `/forbidden` redirect.
- **`AdminUsersEndpoints`** — minimal API mapping for the query. A `null` result from the handler answers `403`.
- **`SearchUsersHandler`** in Application `Admin/` — `HandleAsync(term, page)` requires System Admin and returns a `PagedResult<AdminUserSummary>`, or `null` for any other caller. Page size: 25, ordered by name. Search matches name or email, case-insensitive, and includes suspended accounts. Status is Suspended when the profile is suspended, Unverified when the email is not confirmed, and Active otherwise.
- **System Admin override** — not a shared class. Each feature's own access check grants System Admin and tells its handler that the grant was by override. For profiles this is `ProfileAccess.AuthorizeEditAsync` (ADR 0004): it answers `EditAccess.Owner`, `EditAccess.AdminOverride` or `EditAccess.Forbidden`, and the profile handlers write an audit entry only for `AdminOverride`. Contacts and the Agile workspaces are not built yet; their designs apply the same rule.
- **Edit another member's profile** — the built override screen. `ProfilePage` shows *Edit profile* whenever `ProfileDto.CanEdit` is true (owner or System Admin), linking to `/people/me/edit` on the caller's own profile and to `/people/{id}/edit` on anyone else's. `EditProfilePage` takes the route's `id` (`me` by default) and loads, saves and changes photos for that profile. For another member it is titled "Edit {name}’s profile", says "You’re editing as System Admin. Every change is recorded in the audit log.", names the member in the breadcrumb and Cancel returns to their profile (`profile/admin`, `edit-profile/admin` mocks). When `CanEdit` is false it shows the forbidden state "You can only edit your own profile" with *Back to profile* and no form (`edit-profile/forbidden` mock); the API refuses any change regardless (ADR 0004).
- **`IAuditLog`** — `Record(actorId, action, targetType, targetId, before, after)` adds the override entry to the same unit of work as the change.

Whether read-only override views (for example, reading a private contact) are audited per request or per session: per request, as `L2-012` AC2 requires for contacts.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-040` | `L1-014` | Admin users page and override |

### Acceptance criteria

**`L2-040` — Admin users page and override**

1. Given a System Admin, when they open admin users, then they can search all users and see each user's roles and status.
2. Given a System Admin, when they view or change any record, including private contacts and workspaces, then the action succeeds.
3. Given a System Admin viewing another member's profile, when they choose "Edit profile", then the editor opens at `/people/{id}/edit` for that member, not their own, and saving changes that member's details and photos, with each change audited (L2-041 AC1).
4. Given a user who is not a System Admin, when they open another member's editor at `/people/{id}/edit`, then a forbidden state is shown with no form, and the API refuses any change (L2-006 AC3).

## Diagrams

### System context

The System Admin is the only actor. Override applies inside FaithTech Community; no external system participates.

![C4 system context for admin users page and override](diagrams/c4-context.png)

### Containers

The `admin` and `profiles` feature libraries in the Angular web app call the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for admin users page and override](diagrams/c4-container.png)

### Components

`SearchUsersHandler` serves the admin users page. Each feature handler asks its own access check, such as `ProfileAccess`, and writes to `AuditLog` when access is by override.

![C4 component view for admin users page and override](diagrams/c4-component.png)

### Class structure

`SearchUsersHandler` checks `ICurrentUser` for System Admin and returns `AdminUserSummary` items, whose `Status` is a `UserStatus` name. `ProfileAccess` is the built example of the override rule: it returns `EditAccess`, and the profile handlers call `IAuditLog` for `AdminOverride`.

![Class diagram for admin users page and override](diagrams/class-structure.png)

### Behaviour — search users

The handler requires System Admin and returns a page of users with roles and status (`L2-040` AC1).

![Sequence diagram for search users](diagrams/sequence-search-users.png)

### Behaviour — override access to an owned record

Any feature handler that receives a request for a record the caller does not own asks its feature's access check. A System Admin is granted access as `AdminOverride` and an audit entry is written (`L2-040` AC2). The diagram uses the profile edit as the built example.

![Sequence diagram for override access to an owned record](diagrams/sequence-override-access.png)

## Open questions

Decisions recorded while implementing:

- Users are addressed by **profile id** in every admin route (`/api/admin/users/{profileId}/...`); the handler resolves the account from `CommunityUser.ProfileId`. `AdminUserSummary` is `Id` (profile id), `Name`, `Email`, `Roles`, `Status`.
- The Admin tab row is Users and Audit log only. The mock once had a "Roles" tab linking to the People page (`L2-053`, built with the profiles feature), a page without the same tab row; it was removed so every tab leads to a page with the same tab set. System Admins assign roles from People, reached from the top bar. The workspace-owner alert in the mock belongs to the Agile design and is deferred with it.
- A non-admin opening `/admin/**` gets the API's `403` and the page shows the forbidden state ("This area is for System Admins").
- The shell shows the **Admin** navigation link only to System Admins.
- The profile override needed a route: `/people/:id/edit` reuses `EditProfilePage` rather than a separate admin editor, so validation, photos and toasts stay one implementation. `ProfilePage` decides from `CanEdit`, not from the caller's roles, so the server stays the authority. Resolved.
