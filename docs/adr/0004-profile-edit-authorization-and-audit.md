# 0004. Profile edit authorization and System Admin audit

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-006 AC3, L2-007, L2-041 AC1
- Designs: `docs/detailed-designs/profiles/edit-own-profile`, `docs/detailed-designs/profiles/manage-profile-photos`

## Context

Only the owner of a profile, or a System Admin, may change it, and every System Admin action must reach the audit log with actor, action, target, before and after values, UTC time and IP address. `ICurrentUser` carries the caller's user id and roles from the access token, but not the profile id; the account → profile link lives on `CommunityUser.ProfileId`.

## Decision

- Every profile write (details, photo upload, description, feature, delete) goes through `ProfileAccess.AuthorizeAsync` in `Application/Profiles/`. It resolves the caller's profile id from `CommunityUser` and answers: owner → allowed; System Admin → allowed and audited; anyone else → `403`. An unknown profile answers `404` before the permission check only for System Admin; other callers get `403`, so a non-admin cannot probe which ids exist.
- `IAuditLog` (Application) writes an `AuditEntry` to the `AuditEntries` table. `AuditLog` in `Infrastructure/Admin/` takes the IP address from the current HTTP request. A System Admin editing **their own** profile is acting as a member and is not audited.
- Audit actions: `profile.updated`, `profile.photo.uploaded`, `profile.photo.described`, `profile.photo.featured`, `profile.photo.deleted`; target type `Profile`, target id the profile id. Before and after are JSON snapshots of the changed fields.

## Consequences

- Staff, being neither owner nor System Admin, are read-only on other profiles without a special case.
- The audit entry is saved in the same `SaveChanges` as the change it records.
