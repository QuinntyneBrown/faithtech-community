# Audit log

## Overview

The **audit log** — append-only record of every System Admin action and every role change in FaithTech Community. Each **audit entry** — immutable row naming the actor, the action, the target, the before and after values, the time in UTC and the caller's IP address. The log supports accountability for the override authority that System Admins hold.

This feature covers both writing entries, which other features trigger through `IAuditLog`, and reading them on the audit log page. Only a System Admin may read the log. No user, including a System Admin, may edit or delete an entry: the API exposes no such operation.

## Description

- **`AuditLogPage`** — page in the `admin` feature library with a category filter (all, role changes, suspensions, private contact access, deletions), the last 90 days by default, paging at 50 entries per page and an **Export CSV** button.
- **`AuditLogService`** / **`AUDIT_LOG_SERVICE`** / **`HttpAuditLogService`** — API client calling `GET /api/admin/audit?category=&actor=&from=&to=&page=` and `GET /api/admin/audit/export?category=&actor=&from=&to=` (CSV).
- **`AuditLogEndpoints`** — maps only the `GET` query. No `PUT`, `PATCH` or `DELETE` route exists.
- **`GetAuditEntriesQuery`** and **`GetAuditEntriesHandler`** — Application `Admin/` query; requires System Admin, defaults `from` to 90 days ago, pages 50 at a time newest first and returns `AuditEntryDto` items with the actor's and target's names and a one-line summary ("Granted City Lead to Esther Nakamura"). The same query, unpaged, feeds the CSV export.
- **`IAuditLog`** — Application abstraction with a single `Record(actor, action, targetType, targetId, before, after)` method, called by role, suspension, override and other admin handlers in the same unit of work as the change.
- **`AuditLog`** — Infrastructure implementation that inserts into the `audit_entries` table. The table grants the application role insert and select only. Retention: entries are kept indefinitely in v1; a purge job is deferred.
- **`AuditEntry`** — Domain record with `Id`, `ActorId`, `Action`, `TargetType`, `TargetId`, `BeforeJson`, `AfterJson`, `OccurredAtUtc` and `IpAddress`. Its constructor requires an action, a target type and a target id and a UTC time; it has no mutators, so an entry cannot change after it is written.
- **`ICurrentUser`** — supplies `ProfileId` and `IpAddress` for the entry.

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

## Diagrams

### System context

System Admins read the log; every admin and role-changing action inside FaithTech Community writes to it. No external system participates.

![C4 system context for audit log](diagrams/c4-context.png)

### Containers

The `admin` feature library in the Angular web app calls the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for audit log](diagrams/c4-container.png)

### Components

Writers reach the log only through `IAuditLog`, implemented by `AuditLog`. Readers reach it only through `GetAuditEntriesHandler`.

![C4 component view for audit log](diagrams/c4-component.png)

### Class structure

`AuditLog` realizes `IAuditLog` and persists `AuditEntry`. `GetAuditEntriesHandler` reads entries through `CommunityDbContext`.

![Class diagram for audit log](diagrams/class-structure.png)

### Behaviour — write an audit entry

An admin or role-changing handler writes the entry in the same unit of work as the change, so a change never commits without its entry.

![Sequence diagram for write an audit entry](diagrams/sequence-write-entry.png)

### Behaviour — view the audit log

Only System Admins may read entries, filtered by actor, action and date range and paged 50 at a time (`L2-041` AC2, AC4).

![Sequence diagram for view the audit log](diagrams/sequence-view-audit-log.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- Filter categories (`L2-041` AC2) map onto the `Action` values written by each feature; the Domain does not add a separate category field.
- Categories: `roles` → actions starting `role.`; `suspensions` → `user.suspended`, `user.reinstated`; `contacts` → actions starting `contact.`; `deletions` → actions ending `.deleted`.
- Actions written so far: `role.granted`, `role.removed` (before and after hold the role sets), `user.suspended` (after holds the reason), `user.reinstated`, and the profile actions of ADR 0004.
- The CSV export holds at most 10,000 rows; columns are When (UTC), Who, Action, Summary, Target type, Target id, IP address.
