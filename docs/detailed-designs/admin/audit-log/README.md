# Audit log

## Overview

The **audit log** — append-only record of every System Admin action and every role change in FaithTech Community. Each **audit entry** — immutable row naming the actor, the action, the target, the before and after values, the time in UTC and the caller's IP address. The log supports accountability for the override authority that System Admins hold.

This feature covers both writing entries, which other features trigger through `IAuditLog`, and reading them on the audit log page. Only a System Admin may read the log. No user, including a System Admin, may edit or delete an entry: the API exposes no such operation.

## Description

- **`AuditLogPage`** — page in the `admin` feature library at `/admin/audit-log` with a category filter (all, role changes, suspensions, private contact access, deletions), the last 90 days by default, 50 entries at a time with a **Show older entries** button, and an **Export CSV** button that reads "Exporting…" and is busy (`ButtonComponent` `loading`) while the file is prepared, then shows a `ToastService` success toast ("Audit log exported") or, on failure, a danger toast with **Try again** (mocks `exporting`, `exported`, `export-failed`). It shows When, Who and What (the entry summary). While loading, `TableComponent` with `loading` keeps the When, Who and What headers and shows skeleton rows, and a `403` shows the page's own forbidden state. Each category change or retry starts a new request generation; an entries page, a *Show older entries* page or a failure from an older one is dropped, so the rows, totals, empty text and paging always match the chosen category.
- **`AuditLogService`** / **`AUDIT_LOG_SERVICE`** / **`HttpAuditLogService`** — API client in the `api` library. `getEntries(filters, page)` calls `GET /api/admin/audit?category=&actor=&from=&to=&page=` and `exportCsv(filters)` calls `GET /api/admin/audit/export?category=&actor=&from=&to=` for a CSV blob. Both requests carry the `HANDLES_FORBIDDEN` `HttpContextToken`, so a `403` reaches the page instead of the global `/forbidden` redirect. The page sends only the category; the API also accepts `actor`, `from` and `to`.
- **`AuditLogEndpoints`** — maps only the two `GET` routes. No `PUT`, `PATCH` or `DELETE` route exists. The export route writes the CSV with the columns When (UTC), Who, Action, Summary, Target type, Target id and IP address, and prefixes a cell that starts with `=`, `+`, `-` or `@` with `'`. Dates without an offset are read as UTC.
- **`GetAuditEntriesQuery`** (`Category`, `Actor`, `From`, `To`, `Page`) and **`GetAuditEntriesHandler`** — Application `Admin/` query. `HandleAsync` requires System Admin, defaults `From` to 90 days ago, pages 50 at a time newest first and returns `AuditEntryDto` items with the actor's name, the target's name and a one-line summary ("Granted City Lead to Esther Nakamura"). `HandleAllAsync` applies the same filters unpaged, up to 10,000 rows, for the CSV export. Both return `null` to any other caller, which the endpoint answers with `403`.
- **`IAuditLog`** — Application abstraction with a single `Record(actorId, action, targetType, targetId, before, after)` method, called by the role, suspension, invite-acceptance and profile-override handlers. It adds the entry to the current unit of work, so the entry is saved with the change it records.
- **`AuditLog`** — Infrastructure implementation in `Infrastructure/Admin/`. It serializes before and after to JSON, stamps the UTC time and takes the IP address from the current HTTP request (`unknown` when there is none), and adds the entry to the `AuditEntries` table. Retention: entries are kept indefinitely in v1; a purge job is deferred.
- **`AuditEntry`** — Domain record with `Id`, `ActorId`, `Action`, `TargetType`, `TargetId`, `BeforeJson`, `AfterJson`, `OccurredAtUtc` and `IpAddress`. Its constructor requires an action, a target type, a target id and a UTC time; it has no mutators, so an entry cannot change after it is written.
- **`ICurrentUser`** — supplies the caller's user id and roles; handlers resolve the actor's profile id from it.
- **`CommunitySeeder.GrantSystemAdminAsync`** — writes the one entry made outside a request: the Cli `grant-admin` command's `role.granted`, with an empty actor id (shown as "System") and IP address `cli`.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-041` | `L1-014` | Audit log |

### Acceptance criteria

**`L2-041` — Audit log**

1. Given any System Admin action, or any role change, when it completes, then an audit entry stores the actor, the action, the target, the before and after values, the time in UTC, and the IP address.
2. Given the audit log, when a System Admin views it, then it shows when, who and what for the last 90 days by default, can be filtered by category (role changes, suspensions, private contact access, deletions), and is paged 50 at a time.
3. Given any user, when they try to edit or delete an audit entry, then no API exists to do so, and the entry is unchanged.
4. Given a user who is not a System Admin, when they request the audit log, then the response is 403.
5. Given the audit log, when a System Admin chooses "Export CSV", then the filtered entries are downloaded.
6. Given an export in progress, when the file is being prepared, then "Export CSV" is busy and cannot be pressed again; when the download is ready, a success toast "Audit log exported" confirms it; when it fails, a danger toast "We couldn’t export the audit log" offers "Try again".

## Diagrams

### System context

System Admins read the log; every admin and role-changing action inside FaithTech Community writes to it. No external system participates.

![C4 system context for audit log](diagrams/c4-context.png)

### Containers

The `admin` feature library in the Angular web app calls the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for audit log](diagrams/c4-container.png)

### Components

Writers reach the log through `IAuditLog`, implemented by `AuditLog`; the Cli first-admin grant is the one exception. Readers reach it only through `GetAuditEntriesHandler`.

![C4 component view for audit log](diagrams/c4-component.png)

### Class structure

`AuditLog` realizes `IAuditLog` and adds `AuditEntry` rows. `GetAuditEntriesHandler` handles `GetAuditEntriesQuery`, reads entries through `IApplicationDbContext` and returns `AuditEntryDto` items.

![Class diagram for audit log](diagrams/class-structure.png)

### Behaviour — write an audit entry

An admin or role-changing handler writes the entry in the same unit of work as the change, so a change never commits without its entry.

![Sequence diagram for write an audit entry](diagrams/sequence-write-entry.png)

### Behaviour — view the audit log

Only System Admins may read entries, filtered by category, actor and date range and paged 50 at a time (`L2-041` AC2, AC4). The export uses the same filters (`L2-041` AC5).

![Sequence diagram for view the audit log](diagrams/sequence-view-audit-log.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- Filter categories (`L2-041` AC2) map onto the `Action` values written by each feature; the Domain does not add a separate category field.
- Categories: `roles` → actions starting `role.`; `suspensions` → `user.suspended`, `user.reinstated`; `contacts` → actions starting `contact.`; `deletions` → actions ending `.deleted`.
- Actions written so far: `role.granted`, `role.removed` (before and after hold the role sets), `user.suspended` (after holds the reason), `user.reinstated`, and the profile actions of ADR 0004. Accepting an invite with a pre-assigned role writes `role.granted` with the inviter as actor (ADR 0006).
- Docs & notes adds `note.opened`, `note.edited`, `note.shared`, `note.moved`, `note.archived` and `note.restored` (target type `NotePage`), written for a System Admin acting on, or opening a Private, Shared or archived, page they do not own (ADR 0025, `notes/share-and-visibility`).
- The CSV export holds at most 10,000 rows; columns are When (UTC), Who, Action, Summary, Target type, Target id, IP address.
- Immutability rests on the entity having no mutators and the API having no edit or delete route. The migrations do not restrict the database role to insert and select on `AuditEntries`; a database-level insert-and-select grant is deferred to the deployment design (`eng/infra`), since the role the API connects as is created there.
