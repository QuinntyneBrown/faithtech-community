# 0005. Role dialogs live in components, role calls in api

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-008, L2-009 AC2, AC5
- Designs: `docs/detailed-designs/admin/assign-roles`, `docs/detailed-designs/admin/admin-users-and-override`

## Context

The add-role and remove-role dialogs open from the profile page (`profiles` library) and from admin screens (`admin` library). Feature libraries must not depend on each other (`AGENTS.md`), so the dialogs cannot live in `admin` and be imported by `profiles`. The `components` library may not call the API.

## Decision

- `RoleDialogComponent` in `components` is a presentational CDK dialog for both modes (`add`, `remove`). It receives the person's name, a description, the role options (value, label, description) and a `submit(value)` callback through `DIALOG_DATA`. It owns the invalid ("Choose a role to add."), busy and failed states and closes with the chosen value once `submit` resolves. `submit` resolves to `null` on success or to a message the dialog shows (for example a `403` or the last-System-Admin `409`); a rejected promise shows the generic "That didn’t work" alert.
- `RolesService` / `ROLES_SERVICE` in `api` call `POST /api/profiles/{id}/roles` and `DELETE /api/profiles/{id}/roles/{role}`; both return the profile's new role set.
- `api` also exports `assignableRoles(callerRoles)` and `ROLE_DESCRIPTIONS`, mirroring the server's `RoleAssignmentPolicy` so screens only offer roles the caller may change (L2-009 AC2). The server still answers `403` for anything else.
- Each feature (`profiles`, `admin`) opens the dialog with `DialogService` and passes a `submit` that calls `ROLES_SERVICE`, then updates its own state with the returned roles (no page reload, L2-009 AC5).

## Consequences

- No feature depends on another; the only shared pieces are a generic component and an API contract.
- The policy exists twice (C# and TypeScript). The server is the authority; the client copy only hides options.
