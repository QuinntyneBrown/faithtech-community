# SCAFFOLD: project `admin`

This folder was scaffolded from `AGENTS.md` and the sources below. Everything in it is a placeholder, not the implementation. Overwrite each file with the expected implementation (follow the `implementing-incrementally` skill and ATDD in `AGENTS.md`), then delete the `SCAFFOLD` comments and this file.

Feature library `@faithtech-community/admin`: pages, routes, feature dialogs and the glue between api services and components. Depends only on @faithtech-community/components and @faithtech-community/api.

Sources:

- `docs/detailed-designs/admin/admin-users-and-override`
- `docs/detailed-designs/admin/assign-roles`
- `docs/detailed-designs/admin/audit-log`
- `docs/detailed-designs/admin/suspend-users`

## Open questions (TO CONFIRM before implementing)

- `AddRoleDialog` and `RemoveRoleDialog` are opened from the profile page (`profiles` library), but feature libraries must not depend on each other. Decide how the profile page reaches them (for example, the dialogs move to `components` + `api`, or the app wires them) before implementing.
