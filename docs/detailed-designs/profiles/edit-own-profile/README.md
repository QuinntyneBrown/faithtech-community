# Edit own profile

## Overview

Each member maintains the name, home {chapter} and bio on their own profile. *Edit own profile* covers changing them and the rule that only the owner, or a holder of `AdministerOrganisation` as an audited override, may change a profile.

**owner** — the account whose `UserId` the profile carries in the current organisation (ADR 0032)

**administrator override** — a holder of `AdministerOrganisation` changing another member's profile, recorded in the audit log (`L2-135` AC5)

The edit happens on the dedicated `edit-profile` screen at `/people/me/edit`, not inline (an administrator reaches the same screen for another member at `/people/{id}/edit`, see `admin/admin-users-and-override`), in line with the frontend conventions. A name is required and shall not exceed 100 characters; a bio shall not exceed 400 characters. Sign-up and invite sign-up apply the same name limit, so a new member can always save their name unchanged. A name stored before that rule that is longer than 100 characters is shown in full and never truncated; saving shows the inline name error and focuses the field, and the member shortens it themselves (`L2-006` AC2).

## Description

- **`EditProfilePage`** — page in the `profiles` feature library, matching the `edit-profile` mock. It uses `FormFieldComponent`, `TextFieldComponent`, a home {chapter} `SelectComponent` listing the organisation's active chapters from `GET /api/organisation` (plus the member's current chapter when archived), shown only when chapters are on (`L2-141` AC1), and `TextareaComponent` (with `maxlength` 400 on the bio, which shows the characters-left counter), an `ErrorSummaryComponent` and inline errors on a failed save, a `FormActionsComponent` row that puts the ghost *Cancel* link first and the busy *Save profile* button last, end-aligned like a dialog footer, and `ToastService` for the "Profile saved" toast.
- **`ProfilesService`** — contract in the `api` library, provided through the `PROFILES_SERVICE` injection token and implemented by `HttpProfilesService`.
- **`ProfilesEndpoints`** — minimal API route group in `FaithTech.Community.Api` under `/api/profiles`. Its endpoints require authentication by default and hold no business logic.
- **`ICurrentUser`** — Application abstraction exposing the caller's user id and capabilities. **`ProfileAccess`** resolves the caller's profile in `ICurrentOrganisation` by `Profile.UserId` and decides owner, `AdministerOrganisation` override (audited, `L2-135` AC5) or forbidden (ADR 0004). Every query is scoped by the DbContext's global filter on `ICurrentOrganisation`.
- **`Profile`** — Domain entity holding `Name`, `ChapterId`, `Roles` and the `Photos` collection.
- **`UpdateProfileCommand`** carries `ProfileId`, `Name`, `ChapterId` and `Bio`.
- **`UpdateProfileValidator`** — rejects an empty name ("Enter your name as you’d like people to see it."), a name longer than 100 characters ("Use 100 characters or fewer for your name."), a `ChapterId` that is not one of the organisation's chapters (the member's current chapter stays allowed when archived, `L2-141` AC1) and a bio longer than 400 characters ("Use 400 characters or fewer for your bio."). The endpoint is `PUT /api/profiles/{id}` with `{ name, chapterId, bio }` and answers `204`, `400`, `403` or `404`.
- **`UpdateProfileHandler`** — Application handler. It returns forbidden unless the caller owns the profile or holds `AdministerOrganisation`, calls `Profile.Update(name, chapterId, bio)`, saves, and writes an audit entry through `IAuditLog` when the caller edits another profile as an override.
- **`IAuditLog`** — Application abstraction implemented by `AuditLog` in Infrastructure; it adds an `AuditEntry` (actor, action `profile.updated`, target, before and after JSON, UTC time, IP address) saved with the change (L2-041).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-006` | `L1-002` | Edit own profile |
| `L2-141` | `L1-027`, `L1-002`, `L1-008` | Chapters on profiles, events and role assignments |

### Acceptance criteria

**`L2-006` — Edit own profile**

1. Given a signed-in user, when they change their name, home {chapter} (a picker of the organisation's active chapters, shown only when chapters are on, `L2-141` AC1) or bio and save, then the profile updates and a success toast is shown.
2. Given an empty name or a name longer than 100 characters, when they save, then an inline error is shown and nothing is saved.
3. Given a user who does not hold `AdministerOrganisation`, when they try to edit another user's profile through the API, then the response is 403.
4. Given a bio longer than 400 characters, when they save, then an inline error is shown.
5. Given the bio field, when the user types, then a counter under it shows how many of the 400 characters are left; once the bio is longer than 400 characters it says how many characters too many, in the danger colour, and nothing is cut off.

**`L2-141` — Chapters on profiles, events and role assignments**

1. Given chapters are on, when a member edits their profile (`L2-006`), then "Home {chapter}" is an optional picker of the active chapters (plus the member's current one if archived) in place of the former free-text home city; the profile page and person cards show it.
2. Given chapters are on, when an event is created or edited (`L2-020`), then "{Chapter}" is an optional picker of the active chapters; none means organisation-wide, shown as "{Organisation}-wide"; the event list, event page, public page, `.ics` location line and Home show the chapter name.
3. Given a role assignment on a chapter-scopable definition (`L2-138` AC6), when it is shown as a badge on a profile, in People, on the team list or on the connect page, then it reads "{role} · {chapter}", or "{role}" when untagged.
4. Given a contact (`L2-013`), when it is created or edited, then its city stays a free-text field labelled "City", whatever the chapter label, because a contact is an outsider.
5. Given a partner, when it is shown or counted, then it has no chapter of its own; reports attribute it to its owner's home chapter (`L2-125`).
6. Given the FaithTech migration, when it runs, then one chapter per distinct trimmed, case-folded former home city and event city value is created with the label City/Cities, exact matches are mapped, unmatched values are set to none and written to the migration log, and running it again changes nothing.

## Diagrams

### System context

Members edit their own profile; administrators may edit any profile as an audited override.

![C4 system context for editing one's own profile](diagrams/c4-context.png)

### Containers

The web app sends the update to the Community API, which writes the profile and any audit entry to the Community database.

![C4 container view for editing one's own profile](diagrams/c4-container.png)

### Components

`ProfilesEndpoints` forwards an `UpdateProfileCommand` to `UpdateProfileHandler`, which validates, authorizes against `ICurrentUser`, renames the profile and audits admin overrides.

![C4 component view for editing one's own profile](diagrams/c4-component.png)

### Class structure

`UpdateProfileHandler` depends on the command, its validator, `ICurrentUser` and `IAuditLog`, and mutates `Profile` through `Update`.

![Class diagram for editing one's own profile](diagrams/class-structure.png)

### Behaviour — update the profile name

The page and the validator reject invalid names. The handler returns 403 to any caller who is neither the owner nor a holder of `AdministerOrganisation`, and otherwise saves and confirms with a toast (`L2-006`).

![Sequence diagram for update the profile name](diagrams/sequence-update-name.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `L2-006` covers name, home city and bio while this design covered only the name. `Profile.Update(name, homeCity, bio)` replaces `Rename`; it rejects a blank name, and length limits stay in the validator. Resolved.
- Home city is free text (up to 100 characters) on a text field rather than a fixed select: there is no list of cities to choose from. The mock is updated. Resolved.
- Capabilities and chapters: the free-text home city is now `Profile.ChapterId`, a picker of the organisation's chapters, and the override is `AdministerOrganisation` rather than a role name (ADR 0033, ADR 0034).
- Success is confirmed with a toast (L2-006 AC1, L2-054) rather than the inline alert the first mock showed. The mock is updated. Resolved.
- The page saves the details and the photo changes (new uploads and changed descriptions) with one *Save profile* button; see *Manage profile photos*. Resolved.
