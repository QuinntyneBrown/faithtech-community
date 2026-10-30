# Send an announcement

## Overview

An *announcement* is a message with a subject and a body that a holder of `SendAnnouncements` sends to a chosen audience (seeded as Communications Lead in FaithTech). Announcements are the broadcast channel of the Community platform, distinct from notifications that the system raises automatically.

- **audience** — set of recipients chosen at compose time: every member of the organisation, the holders of one or more of the organisation's non-archived role definitions (resolved live at send time, ADR 0025), or the RSVP list of one event
- **recipient count** — number of members the chosen audience resolves to at the moment of preview

Each recipient receives an in-app notification and, unless the recipient opted out of announcement emails, an email. Delivery reuses the notifications pipeline described in the in-app and email notification designs. The compose screen is the `compose-announcement` mock.

## Description

- **`ComposeAnnouncementPage`** — page in the `announcements` feature library (mock `pages/compose-announcement`). It collects the audience (Everyone; People with a role, chosen with a checkbox group of the organisation's non-archived role definitions from `GET /api/organisation`; or an upcoming event's RSVP list), subject, message and "Also send by email" (on by default), shows the recipient count in the send button ("Send to 41 people"), shows inline field errors with an error summary, and after sending shows who it reached and how many by email. Anyone whose capabilities (`/api/me`) lack `SendAnnouncements` is sent to the forbidden page.
- **`AnnouncementsService`** / **`ANNOUNCEMENTS_SERVICE`** / **`HttpAnnouncementsService`** — API client contract, token and HTTP implementation in the `api` library.
- **`AnnouncementsEndpoints`** — minimal API mapping for `POST /api/announcements/recipient-count` (an `AudienceRequest`, answering `{ count }`) and `POST /api/announcements` (answering `201` with `{ id, recipientCount, emailCount }`).
- **`AudienceRequest`** / **`AudienceRequestValidator`** — the audience as sent: `kind` (`Everyone`, `Roles`, `EventRsvps`) with `roles` (at least one non-archived role definition id of the organisation) or `eventId`.
- **`SendAnnouncementCommand`** / **`SendAnnouncementValidator`** — subject (1 to 200 characters), body (1 to 5,000), audience and `alsoEmail`; an empty subject or body answers `400` with "Add a subject so people know what it’s about." and "Write a message of at least one sentence."
- **`AnnouncementAccess`** — `CanSend` is `ICurrentUser.Has(Capability.SendAnnouncements)`; everyone else gets `403` for the count and the send. A send by a holder of `AdministerOrganisation` without `SendAnnouncements` is an override, `AuthorizationRules.IsOverride(actor, SendAnnouncements)`, and is audited (`L2-135` AC5).
- **`AudienceResolver`** — resolves an audience to the members who receive it, in the database and within the current organisation (the DbContext's global filter on `ICurrentOrganisation`): members whose membership is not suspended; for roles, the profiles holding any of the chosen definitions at send time; for an RSVP list, the members who RSVP'd (guests have no account). An unknown event or an archived role answers `400`.
- **`SendAnnouncementHandler`** — authorizes the caller, stores the `Announcement` with its `AnnouncementRecipient` rows, and publishes one notification per recipient through `INotificationPublisher.PublishAsync`, each email carrying that recipient's unsubscribe link, all in one save.
- **`AnnouncementAudience`** — value object with `Kind` (`Everyone`, `Roles`, `EventRsvps`) and the chosen `RoleIds` or `EventId`, built through `Everyone()`, `ForRoles(...)` (at least one role definition id) or `ForEventRsvps(eventId)`.
- **`Announcement`** — Domain entity with `Subject`, `Body`, `Audience`, `SenderId`, `SentAt` and `AlsoEmail`, plus `AnnouncementRecipient` rows, added once each through `AddRecipients`, that record who received it.
- **`INotificationPublisher`** — creates the in-app notification and enqueues the email, honouring the opt-out and naming the organisation in the email (`L2-028`, `L2-134` AC5).

A send to a large audience runs in one request; the outbox worker delivers the emails, and a background fan-out job is deferred (ADR 0016).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-029` | `L1-011` | Compose and send announcements |
| `L2-136` | `L1-026`, `L1-028` | Role definitions |

### Acceptance criteria

**`L2-029` — Compose and send announcements**

Announcements are sent by holders of `SendAnnouncements`; a holder of `AdministerOrganisation` without it may send too, audited as an override (`L2-135` AC5).

1. Given a holder of `SendAnnouncements`, when they send an announcement with a subject and body to everyone (every member of the organisation), the holders of one or more of the organisation's non-archived role definitions (`L2-136`; the audience is live, ADR 0025), or one event's RSVP list, then each recipient gets an in-app notification.
2. Given an empty subject or body, when they send, then inline errors are shown.
3. Given a member without `SendAnnouncements`, when they call the send API, then the response is 403.
4. Given the compose page, when the audience is chosen, then the number of recipients is shown before sending.
5. Given "Also send by email" is on (the default), when the announcement is sent, then recipients who have not opted out also receive it by email.

**`L2-136` — Role definitions**

1. Given a holder of `ManageRoles` on the Roles page (`/organisation/roles`), when they choose "Define a role", then a dialog asks for a name (required, up to 60 characters, unique within the organisation ignoring case), a description (optional, up to 200), the capabilities (checkbox per catalogue entry with its description) and three switches: "Show on the team list", "Can be held for a {chapter}" (shown only when chapters are on, `L2-140`) and "Oversight role (shows a viewing-as banner)"; `POST /api/organisation/roles` saves it, a success toast confirms (`L2-054`), and an audit entry `role.defined` is written.
2. Given a definition, when the holder edits its name, description, capabilities or flags and saves, then `PUT /api/organisation/roles/{id}` applies the change, every holder's capabilities change on their next request (`L2-133` AC5), and `role.updated` records the before and after.
3. Given a name that is empty, too long or already used by a non-archived definition, when the dialog is saved, then the field shows an inline error, the API answers 400 with problem details (`L2-043` AC1), and nothing is saved.
4. Given a definition with holders, when the holder archives it, then the request is refused with 409 "{n} members hold this role. Remove it from them first."; given it is named by a grant rule, a share audience or an announcement audience, then 409 names what still uses it; given nothing uses it, then `POST /api/organisation/roles/{id}/archive` archives it, it leaves every picker, and `role.archived` is written.
5. Given a definition that carries `AdministerOrganisation`, when an edit would remove that capability, or an archive is attempted, and no other active, unsuspended member would be left holding `AdministerOrganisation`, then the request is refused with 409 "There must always be at least one administrator." (`L2-139`).
6. Given the Roles page, when it renders, then it lists the non-archived definitions in order with name, description, the number of holders, a capability summary and the flags, with an "Archived" filter to show archived ones read-only; the page follows `L2-044` and `L2-045`.
7. Given a holder of `ManageRoles` who does not hold `AdministerOrganisation`, when they add `AdministerOrganisation` to any definition, then the request is refused with 403 "Only an administrator can grant administration."
8. Given any member without `ManageRoles`, when they call any role-definition endpoint, then the response is 403; `GET /api/organisation` still lists the non-archived role names and ids for pickers.

## Diagrams

### System context

A holder of `SendAnnouncements` sends announcements through the Community platform, which delivers email through the email provider.

![C4 system context for send an announcement](diagrams/c4-context.png)

### Containers

The compose page in the web app calls the Community API, which stores the announcement and enqueues email for delivery.

![C4 container view for send an announcement](diagrams/c4-container.png)

### Components

`AnnouncementsEndpoints` validates the command and dispatches it. `SendAnnouncementHandler` authorizes the caller, stores the announcement and publishes through `INotificationPublisher`.

![C4 component view for send an announcement](diagrams/c4-component.png)

### Class structure

`Announcement` composes an `AnnouncementAudience` and its `AnnouncementRecipient` rows. The handler depends on `ICurrentUser` for the capability check and the resolver on `ICurrentOrganisation` for the role definitions.

![Class diagram for send an announcement](diagrams/class-structure.png)

### Behaviour — send an announcement

The page previews the recipient count, then sends. Validation failures return 400, and callers without `SendAnnouncements` receive 403 (`L2-029`).

![Sequence diagram for send an announcement](diagrams/sequence-send-announcement.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `L2-029` lets an announcement target one or more roles; the audience holds a set of roles (`AudienceKind.Roles`) instead of a single role. `AlsoEmail` records the "Also send by email" choice (`L2-029` AC5). Resolved.
- Capabilities: `AnnouncementAccess.CanSend` reads `SendAnnouncements` in place of two role names, and the role audience names the organisation's role definitions by id instead of enumeration values (ADR 0033).
- Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
