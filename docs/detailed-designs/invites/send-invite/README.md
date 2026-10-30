# Send an invite

## Overview

Holders of `InviteMembers` grow the community by inviting people directly. An *invite* is an email carrying a single-use link that lets the recipient join, optionally with a role already granted.

**inviter** — member holding the `InviteMembers` capability (seeded on City Lead, Event Lead, Create Lead and Communications Lead in FaithTech)

**pre-assigned role** — role recorded on the invite and granted when the invite is accepted

Any holder of `InviteMembers` may send invites; a caller without it answers 403. An inviter may pre-assign only the roles their grant rules allow (`grantableRoleIds`, `L2-137` AC5). Every query is scoped by the DbContext's global filter on `ICurrentOrganisation`, so the page lists one organisation's invites. Each invite expires 14 days after it is sent, may be revoked while pending, and each inviter may send at most 50 invites in 24 hours.

## Description

- **`InvitesPage`** — page in the `invites` feature library at `/invites`, matching the `invites` mock. It lists every inviter's invites, newest first, with status badges from `components` (Pending, Accepted, Expired, and Revoked shown as "Withdrawn"), opens `SendInviteDialog`, and offers **Resend** on an expired invite. `ListSkeletonComponent` shows the loading state. A sent or resent invite is added to the top of the list with a success toast.
- **`SendInviteDialog`** — Angular CDK dialog in the `invites` library, matching the `send-invite` mock. It collects an email, an optional role and an optional note, and offers only the organisation's roles whose ids are in `grantableRoleIds` from `/api/me` (`L2-137` AC5). A `403` or `429` refusal (role not allowed, unverified sender, rate limit) shows the server's `detail` in the dialog; an unreachable server shows an *Invite not sent* alert. While sending, the email and note are read-only and the role select is disabled. It closes with the new `InviteDto`.
- **`InvitesService`** — contract in the `api` library, provided through the `INVITES_SERVICE` injection token and implemented by `HttpInvitesService`. `sendInvite`, `listInvites(after?)`, `resendInvite` and `revokeInvite` call the four routes below. `InvitesPage` shows "Showing N of M invites" (`role="status"`) under the list. While `next` is set it offers "Show more invites", which appends the next page. A failed continuation keeps the list and shows a danger `ft-alert`, "We couldn’t load more invites. Try again.", and the button tries again. Sent and resent invites go to the top and add one to the total (mock states `more` and `more-error`). Send and resend carry the `HANDLES_FORBIDDEN` `HttpContextToken`, so a `403` reaches the dialog or page instead of the global `/forbidden` redirect.
- **`InvitesEndpoints`** — minimal API route group in `FaithTech.Community.Api` under `/api/invites`: `POST /api/invites`, `GET /api/invites?after=&pageSize=`, `POST /api/invites/{id}/resend` and `POST /api/invites/{id}/revoke`. It validates the send body with `SendInviteValidator` and holds no business logic.
- **`Invite`** — Domain entity holding `OrganisationId`, `Email`, `TokenHash`, optional `PreassignedRoleId` (a `RoleDefinition` reference), `InvitedBy`, `CreatedAt`, `ExpiresAt` (14 days after creation), optional `Note`, `AcceptedAt`, `AcceptedBy`, `RevokedAt` and a derived `Status(now)`. `MarkAccepted(by, now)` and `Revoke(now)` act only on a pending invite.
- **`InviteStatus`** — `Pending`, `Accepted`, `Expired`, `Revoked`.
- **`SendInviteCommand`** (`Email`, `PreassignedRoleId`, `Note`) and **`SendInviteValidator`** — the request and its checks: a valid email up to 256 characters and a note up to 500 characters.
- **`InviteSender`** — Application service. `CanInvite` is `ICurrentUser.Has(Capability.InviteMembers)`. `SendAsync(command)` resolves the role definition and calls `CreateAsync(email, roleId, note)`, which resend also uses. `CreateAsync` requires `CanInvite` and a verified sender email, checks the pre-assigned role with `RoleGrantPolicy.CanGrant`, enforces the 50-per-24-hours limit, stores the `Invite` with only the token hash, and then sends the email in the organisation's name (`L2-134` AC5) through `IEmailSender`.
- **`InviteTokens`** — `New()` creates 32 random bytes encoded as base64url; `Hash(token)` returns the SHA-256 hash stored as `TokenHash` (ADR 0006).
- **`ManageInvitesHandler`** — Application handler with `ListAsync()`, `ResendAsync(id)` and `RevokeAsync(id)`, each allowed only when `InviteSender.CanInvite`. `ListAsync(after, pageSize)` returns one `InvitePageDto` (`Items`, `Next`, `TotalCount`) of every inviter's invites as `InviteDto`, newest first with ties broken by id (L2-010 AC4, AC7, ADR 0006). Pages hold 50 by default and at most 100 (`L2-046` AC3). `Next` is a keyset continuation, the last invite's creation time and id (`InviteCursor`), so invites sent while an inviter is reading never shift later pages. A malformed `after` answers `400`. In PostgreSQL the id tie-break `Id.CompareTo(c.Id) < 0` translates to a `uuid` comparison. `ResendAsync` accepts only an expired invite and creates a new one through `InviteSender.CreateAsync` with the same email, role and note. `RevokeAsync` accepts only a pending invite.
- **`InviteDto`** — `Id`, `Email`, `PreassignedRoleId`, `PreassignedRoleName`, `Status`, `InvitedByName`, `CreatedAt`, `ExpiresAt`, `AcceptedAt`, `RevokedAt`.
- **`RoleGrantPolicy`** — concrete Application class shared with role assignment (`admin/assign-roles`); `CanGrant(roleDefinitionId)` answers which roles the caller's grant rules allow (`L2-137`).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-010` | `L1-004` | Send invites |
| `L2-137` | `L1-026` | Grant rules |

### Acceptance criteria

**`L2-010` — Send invites**

1. Given a holder of `InviteMembers`, when they send an invite to a valid email with an optional personal note, then an invite email is sent in the organisation's name (`L2-134` AC5) with a single-use link that expires after 14 days.
2. Given a pre-assigned role, when the inviter chooses one, then only the roles the inviter's grant rules allow (`grantableRoleIds`, `L2-137` AC5) can be chosen, and the API refuses any other role with 403.
3. Given a member without `InviteMembers`, when they call the invite API, then the response is 403.
4. Given the invites page, when a holder of `InviteMembers` views it, then it lists the invites sent by every member of the organisation who holds `InviteMembers`, each with its status: pending, accepted or expired.
5. Given an expired invite, when a holder of `InviteMembers` chooses "Resend", then a new invite with a new 14-day link is sent.
6. Given more than 50 invites from one user in 24 hours, when another is sent, then it is rejected with a rate-limit message.
7. Given more than 50 invites, when a holder of `InviteMembers` opens the invites page, then it shows the newest 50 with "Showing 50 of N invites", and "Show more invites" loads the next 50 (pages hold at most 100, `L2-046`) without repeating or skipping any invite, even when invites are sent meanwhile; when loading more fails, the invites already shown stay and "We couldn’t load more invites. Try again." is shown.

**`L2-137` — Grant rules**

1. Given a holder of `ManageRoles` on the Roles page, when they open "Who may grant" for a definition, then a dialog shows every non-archived definition as a checkbox under "Holders of {role} may add and remove:", and `PUT /api/organisation/roles/{id}/grants` saves the chosen set, audited as `role.grants.updated` with before and after.
2. Given a grantor definition that does not carry `AssignRoles`, when rules are saved for it, then the dialog explains "This role can't assign roles until it has the Assign roles capability", and the rules are stored but inactive until it does.
3. Given a grantable definition that carries `AdministerOrganisation`, when it is chosen for a grantor that does not, then the checkbox is disabled with "Only administrators can grant administration" and the API answers 400.
4. Given a holder of `AdministerOrganisation`, when they add or remove any role, then no rule is needed (`L2-138` AC3).
5. Given the invite dialog (`L2-010` AC2), the add-role and remove-role dialogs (`L2-138`) and the People page (`L2-053`), when they offer roles, then they offer exactly the roles the caller's rules allow, computed by the server and returned by `/api/me` as `grantableRoleIds`.

## Diagrams

### System context

Holders of `InviteMembers` send invites from the Community platform, which delivers them through the email provider.

![C4 system context for sending an invite](diagrams/c4-context.png)

### Containers

The web app sends invite commands to the Community API, which stores invites in the Community database and sends email.

![C4 container view for sending an invite](diagrams/c4-container.png)

### Components

`InvitesEndpoints` calls `InviteSender` to send and `ManageInvitesHandler` to list, resend and revoke. `InviteSender` consults `RoleGrantPolicy` and sends through `IEmailSender`.

![C4 component view for sending an invite](diagrams/c4-component.png)

### Class structure

`InviteSender` creates `Invite` entities and depends on `RoleGrantPolicy`, `ICurrentUser`, `ICurrentOrganisation` and `IEmailSender`. `ManageInvitesHandler` reuses `InviteSender` for its permission check and for resend. `Invite` derives its `InviteStatus`.

![Class diagram for sending an invite](diagrams/class-structure.png)

### Behaviour — send an invite

`InviteSender` refuses callers without `InviteMembers`, unverified senders and roles the caller may not grant, rate-limits at 50 per 24 hours, and otherwise stores the invite and sends a single-use link that expires after 14 days (`L2-010`).

![Sequence diagram for send an invite](diagrams/sequence-send-invite.png)

### Behaviour — list, resend and revoke invites

The invites page shows each invite's status and resends an expired invite as a new one (`L2-010` AC4, AC5). Revoke is API-only in v1: revoking a pending invite marks it revoked so its link no longer works.

![Sequence diagram for list, resend and revoke invites](diagrams/sequence-list-and-revoke.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `Invite.Status(now)` is derived, never stored: revoked wins over accepted, accepted over expired, and an invite is expired from exactly 14 days after creation. Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
- Routes: `POST /api/invites` (`Email`, optional `PreassignedRole`, optional `Note` up to 500 characters), `GET /api/invites`, `POST /api/invites/{id}/resend`, `POST /api/invites/{id}/revoke`. Revoke is API-only in v1; the invites mock has no revoke control.
- `Invite` gains an optional `Note`, kept so a resend repeats it.
- A refused send (rate limit, unverified sender, role not allowed) shows the dialog's `limited` state, an alert headed "You can’t send this invite", with the server's message. Resend and revoke answer `409` for an invite in the wrong state ("Only an expired invite can be resent.", "Only a pending invite can be withdrawn.").
- Capabilities: `CanInvite` was decided by role name and the pre-assigned role was limited by `RoleAssignmentPolicy`; both now read `InviteMembers` and the organisation's grant rules through `RoleGrantPolicy` (ADR 0033).
