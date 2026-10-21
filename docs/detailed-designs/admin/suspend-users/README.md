# Suspend users

## Overview

A System Admin may need to stop a person from using FaithTech Community, for example after misuse. **Suspension** — admin-imposed state of an account that refuses sign-in and revokes existing sessions until reinstatement. Suspension does not delete the profile or its data; reinstatement returns the account to normal use.

This feature covers suspending a user with a reason and reinstating them. Only a System Admin may do either. Sign-in itself enforces the suspended state (`L2-003`), so this feature changes account state and revokes tokens, while the identity subsystem refuses later sign-ins.

## Description

- **`AdminUsersPage`** — page in the `admin` feature library that lists users and offers Suspend and Reinstate actions.
- **`SuspendUserDialog`** — CDK dialog that collects the required reason and confirms the suspension.
- **`AdminUsersService`** / **`ADMIN_USERS_SERVICE`** / **`HttpAdminUsersService`** — API client in the `api` library calling `POST /api/admin/users/{id}/suspension` and `DELETE /api/admin/users/{id}/suspension`.
- **`AdminUsersEndpoints`** — minimal API mapping; requires an authenticated caller and sends the command.
- **`SuspendUserCommand`** (`UserId`, `Reason`) and **`ReinstateUserCommand`** (`UserId`) with **`SuspendUserHandler`** and **`ReinstateUserHandler`** in Application `Admin/`. Each handler requires the caller to hold System Admin and returns `403` otherwise.
- **`SuspendUserValidator`** — requires a non-empty reason. Maximum reason length: `<TO SUPPLY>`.
- **`UserAccount`** — Domain/identity account with `IsSuspended`, `SuspendedReason`, `SuspendedAtUtc` and `Suspend(reason)` / `Reinstate()`.
- **`ITokenRevocation`** — Infrastructure service over the OpenIddict token and authorization stores; revokes every token for the account.
- **`IAuditLog`** — records each suspension and reinstatement (`L2-041`).

Whether a System Admin may suspend their own account or another System Admin: `<TO SUPPLY>`.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-039` | `L1-014` | Suspend users |

### Acceptance criteria

**`L2-039` — Suspend users**

1. Given a System Admin, when they suspend a user with a reason after confirming, then that user's sessions are revoked, and sign-in is refused (L2-003).
2. Given a suspended user, when a System Admin reinstates them, then they can sign in again.
3. Given any other role, when it calls the suspend API, then the response is 403.

## Diagrams

### System context

Only the System Admin uses this feature. No external system takes part; session revocation happens inside the Community API's OpenIddict stores.

![C4 system context for suspend users](diagrams/c4-context.png)

### Containers

The `admin` feature library in the Angular web app calls the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for suspend users](diagrams/c4-container.png)

### Components

The page opens `SuspendUserDialog`, which calls the API client. The handler changes `UserAccount`, revokes tokens through `TokenRevocation`, audits, and saves.

![C4 component view for suspend users](diagrams/c4-component.png)

### Class structure

Both handlers depend on `ICurrentUser`, `ITokenRevocation` and `IAuditLog`, and mutate `UserAccount`.

![Class diagram for suspend users](diagrams/class-structure.png)

### Behaviour — suspend a user

The handler rejects non-admin callers with `403`, then sets the suspended state, revokes every token and audits in one unit of work.

![Sequence diagram for suspend a user](diagrams/sequence-suspend-user.png)

### Behaviour — reinstate a user

Reinstatement clears the suspended state so the next sign-in succeeds (`L2-039` AC2).

![Sequence diagram for reinstate a user](diagrams/sequence-reinstate-user.png)
