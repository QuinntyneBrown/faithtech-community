# Accept an invite

## Overview

An invite link brings a person into the community with fewer steps than open sign-up. *Accept an invite* covers opening the link, creating an account or attaching the invite to an existing one, and granting any pre-assigned role.

**invitee** — person addressed by an invite email

**invite token** — random secret in the invite link; the database stores only its hash

Because the invite reached the invited address, signing up with that address counts as email verification. An expired, revoked or already-used invite shows an error and a link to normal sign-up. Acceptance creates the profile in the inviter's organisation, whatever host the invitee started on (`L2-132` AC2); an existing account that accepts gains a profile there when it has none, and the pre-assigned role is added to that profile.

## Description

- **`AcceptInvitePage`** — page in the `invites` feature library at `/accept-invite/{token}`, matching the `accept-invite` mock. It looks up the token, then shows one view: the sign-up form with the invited email (`join`), "Accept invite" for a signed-in account with the invited email (`existing`), "Sign in to accept" when an account already uses the email (`sign-in`), the `wrong-account` message, or the invalid-invite error with a sign-up link. After a `409` on accept it looks the invite up again and shows its new state.
- **`InvitesService`** — contract in the `api` library, provided through the `INVITES_SERVICE` injection token and implemented by `HttpInvitesService`. `getInvite(token)` calls `POST /api/invites/lookup` with `{ token }` in the body (never the URL, so the credential cannot reach request logs); `acceptInvite(token, account?)` calls `POST /api/invites/accept`.
- **`InvitesEndpoints`** — minimal API route group in `FaithTech.Community.Api` under `/api/invites`. The lookup and accept routes opt into anonymous access; the accept route validates the body with `AcceptInviteValidator` and is limited by the `AuthRateLimitPolicy` rate limit. It holds no business logic.
- **`Invite`** — Domain entity holding `OrganisationId`, `Email`, `TokenHash`, optional `PreassignedRoleId` (a `RoleDefinition` reference), `InvitedBy`, `CreatedAt`, `ExpiresAt` (14 days after creation), `AcceptedAt`, `AcceptedBy`, `RevokedAt` and a derived `Status(now)`. `MarkAccepted(by, now)` and `Revoke(now)` act only on a pending invite.
- **`InviteStatus`** — `Pending`, `Accepted`, `Expired`, `Revoked`.
- **`InviteTokens`** — `Hash(token)` gives the SHA-256 hash used to find the invite; the token itself is never stored (ADR 0006).
- **`InviteLookupDto`** — `Status`, `Email`, `InviterName`, `InviterChapter` (the inviter's home {chapter}, `L2-141` AC1), `PreassignedRoleName` and `HasAccount` (an account already uses the invited email).
- **`AcceptInviteCommand`** (`Token`, `Name?`, `Password?`) and **`AcceptInviteValidator`** — a name or password marks a new account; the validator then requires a name of at most 100 characters after trimming, the profile editor's limit ("Use 100 characters or fewer for your name."), and a password that meets the community password rules, including the breached-password check.
- **`AcceptInviteHandler`** — Application handler. `LookUpAsync(token)` returns the `InviteLookupDto`, or `null` for an unknown token, which the endpoint answers with `404`. `AcceptAsync(command)` answers `409` for an invite that is not pending. For a new account it creates a `CommunityUser` with the invited email and `EmailConfirmed = true` and a profile in the inviter's organisation; for a signed-in account it loads that account and creates its profile in the inviter's organisation when it has none (`L2-132` AC2). It then grants the pre-assigned `RoleDefinition` to that profile through `Profile.AddRole`, marks the invite accepted and adds an `InviteAccepted` notification for the inviter, all saved in one unit of work. The invite email links to the inviter's organisation host (`L2-134` AC5), so the lookup runs on that host and every query is scoped by the DbContext's global filter on `ICurrentOrganisation`; a token from another organisation answers `404` (`L2-130` AC3).
- **Email mismatch** — a signed-in account whose email differs from the invited email cannot accept (`409` "This invite is for another email.", mock state `wrong-account`; ADR 0006).
- **Role grant audit** — a role granted through an invite is recorded through `IAuditLog` as `role.granted` with the inviter as actor (ADR 0006). A role the account already holds is not granted again.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-011` | `L1-004` | Accept invites |
| `L2-132` | `L1-025`, `L1-001`, `L1-002` | Accounts and memberships |

### Acceptance criteria

**`L2-011` — Accept invites**

1. Given a valid invite link, when the invitee signs up with the invited email, then the email counts as verified, a profile is created in the inviter's organisation whatever host the invitee started on (`L2-132` AC2), and any pre-assigned role is granted to that profile.
2. Given an expired, revoked or used invite, when the invitee opens it, then they see an error and a link to normal sign-up on the organisation's host.
3. Given an existing account, when its owner accepts an invite, then a profile is created in the inviter's organisation if the account has none there, and the pre-assigned role is added to that profile.
4. Given an invite is accepted, when the acceptance completes, then the inviter receives an in-app notification.
5. Given a new account, when the invitee enters a name longer than 100 characters after trimming, then the name field shows "Use 100 characters or fewer for your name." and no account is created (`L2-006`).

**`L2-132` — Accounts and memberships**

1. Given a visitor signs up on an organisation's host (`L2-001`, `L2-078`, `L2-083`), when the account is created, then a profile is created in that organisation, and when the email already has an account, then on verification the existing account gains a profile in that organisation if it has none, with the same `202` outcome either way.
2. Given an invite (`L2-011`) or a connect link (`L2-083`), when it is accepted, then the profile is created in the inviter's or link owner's organisation, whatever host the acceptor started on.
3. Given a verified account with no profile in the current organisation, when it signs in on that host, then the not-a-member page is shown ("You're not a member of {organisation name}") with a sign-out link and, when the account has other memberships, links to their hosts; every API call answers 403 and `/api/me` answers 403 with `reason: not-a-member`.
4. Given an account with profiles in several organisations, when it is used on one host, then only that organisation's profile, roles, capabilities, photos, contacts, notifications and data are visible or counted (`L2-130`).
5. Given a profile is suspended (`L2-039`), when the account signs in on that organisation's host, then sign-in is refused with "Your membership of {organisation name} is suspended"; on another host where it holds an active profile, sign-in succeeds.
6. Given an account locked by a platform operator (`L2-148`), when it signs in on any host, then sign-in is refused with the suspended-account message of `L2-003` AC4.
7. Given a password reset, email verification or Google sign-in (`L2-002`, `L2-004`, `L2-078`), when it completes, then it applies to the account everywhere; it creates no membership.

## Diagrams

### System context

The invitee accepts an invite in the Community platform, and the inviter receives an in-app notification. No external system takes part.

![C4 system context for accepting an invite](diagrams/c4-context.png)

### Containers

The web app sends the token to the Community API, which reads and updates invites, accounts and roles in the Community database.

![C4 container view for accepting an invite](diagrams/c4-container.png)

### Components

`InvitesEndpoints` exposes the anonymous token lookup and the anonymous accept route. `AcceptInviteHandler` looks up the invite by token hash, creates or resolves the account, grants the role, audits it and notifies the inviter.

![C4 component view for accepting an invite](diagrams/c4-component.png)

### Class structure

`AcceptInviteHandler` reads `Invite`, returns `InviteLookupDto` for the lookup, creates or loads `CommunityUser`, creates the `Profile` in the inviter's organisation when the account has none there, adds the pre-assigned `RoleDefinition` to it, records it through `IAuditLog` and adds a `Notification` for the inviter.

![Class diagram for accepting an invite](diagrams/class-structure.png)

### Behaviour — accept an invite

A stale or unknown invite shows an error with a sign-up link. A pending invite either creates a verified account or attaches to the signed-in account with the invited email, creates the profile in the inviter's organisation when needed (`L2-132` AC2), then grants the pre-assigned role, marks the invite used and notifies the inviter (`L2-011`).

![Sequence diagram for accept an invite](diagrams/sequence-accept-invite.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `Invite.Status(now)` is derived, never stored: revoked wins over accepted, accepted over expired, and an invite is expired from exactly 14 days after creation. Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
- Page states: `default` (new account form), `invalid`, `error` (expired: "This invite has expired"; used: "This invite has already been used"; revoked: "This invite was withdrawn"; unknown token: "This invite link isn’t valid"), `existing` (signed in with the invited email: "Accept invite"), `sign-in` (an account already uses the email: "Sign in to accept"), `wrong-account`. In `AcceptInvitePage` the `default` state is the `join` view, the `error` messages render in the `invalid` view, and a failed lookup shows an `unreachable` view with a retry.
- After a new account accepts, the page signs in with the chosen password and lands on the member's own profile. A signed-in account that accepts goes to its own profile at `/people/me`.
- Capabilities: the pre-assigned role was a `Role` enumeration value; it is now a `RoleDefinition` reference granted to the profile in the inviter's organisation (ADR 0033, ADR 0032).
