# Link a contact on sign-up

## Overview

When a person a lead has recorded as a private contact later joins FaithTech Community, the lead benefits from connecting the two records. **Contact link** — association from a private contact to the real profile of the same person. A linked contact shows the profile's name and photo while keeping the lead's private notes.

The trigger is email verification, not sign-up. Once a new account verifies an email that matches one or more contacts, each owning lead receives an in-app and email notification offering to link. The lead may link at once from the notification or dismiss it and link later from the contact page. Linking never reveals the contact or its notes to the person.

## Description

- **`EmailVerified`** — Domain event raised by the identity subsystem when an account's email becomes verified (`L2-002`).
- **`ContactSignedUpHandler`** — Application `Contacts/` handler, called by `ConfirmEmailHandler` and by `AcceptInviteHandler` when a new account is created verified. It finds active, unlinked contacts whose `Email` matches the verified email case-insensitively and, for each owner, raises a `ContactSignedUp` notification. Unverified accounts raise no event, so no notification is sent (`L2-015` AC3).
- **Notification and email** — the handler adds the in-app `Notification` to the unit of work and sends the email through `IEmailSender` (the outbox), as `RoleChangeNotifier` does; there is no separate `INotificationService` yet.
- **`LinkContactDialog`** — CDK dialog in the `contacts` feature library, opened from the notification or from `ContactPage`, that confirms "Link contact".
- **`ContactsService.link(contactId, profileId, discardNotes)`** — calls `POST /api/contacts/{id}/link`.
- **`LinkContactCommand`** / **`LinkContactHandler`** — check ownership through `ContactAccessPolicy`, call `Contact.LinkTo(profileId, discardNotes)` and save. Notes are kept unless the lead chose to discard them (`L2-015` AC5).
- **`ContactDto`** — when `LinkedProfileId` is set, the name and featured photo come from the profile.

Behaviour when two accounts share one contact email over time, or when a linked profile is deleted: deferred, because profiles are not deleted in v1 and a contact links once ([ADR 0007](../../../adr/0007-contacts-and-partners-access-and-open-questions.md)).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-015` | `L1-005` | Contact signs up |

### Acceptance criteria

**`L2-015` — Contact signs up**

1. Given a contact with email X, when a person signs up and verifies email X, then the owning lead receives an in-app and email notification.
2. Given that notification, when the lead confirms "Link contact", then the contact is linked to the real profile, private notes are kept, and the contact shows the profile's name and photo.
3. Given an unverified email, when the person signs up, then no notification is sent until the email is verified.
4. Given the lead dismisses the match ("Not them"), when they view the contact later, then they can still link it.
5. Given the link dialog, when the lead chooses to discard their notes, then the contact is linked and the private notes are deleted.

## Diagrams

### System context

The lead receives in-app and email notifications from FaithTech Community, which sends email through the email provider.

![C4 system context for link a contact on sign-up](diagrams/c4-context.png)

### Containers

The `contacts` feature library in the Angular web app calls the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database and sends email through the email provider.

![C4 container view for link a contact on sign-up](diagrams/c4-container.png)

### Components

`ContactSignedUpHandler` reacts to email verification and notifies owners. `LinkContactHandler` performs the link on the lead's confirmation.

![C4 component view for link a contact on sign-up](diagrams/c4-component.png)

### Class structure

`ContactSignedUpHandler` consumes `EmailVerified` and depends on `INotificationService`. `LinkContactHandler` calls `Contact.LinkTo`.

![Class diagram for link a contact on sign-up](diagrams/class-structure.png)

### Behaviour — notify the lead after verification

Only a verified email triggers matching, so unverified sign-ups notify no one (`L2-015` AC1, AC3).

![Sequence diagram for notify the lead after verification](diagrams/sequence-notify-lead.png)

### Behaviour — link a contact

The lead confirms from the notification or later from the contact page; the link keeps notes and shows the profile's name and photo (`L2-015` AC2, AC4).

![Sequence diagram for link a contact](diagrams/sequence-link-contact.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `L2-015` AC5 lets the lead discard notes while linking; `LinkTo` takes a `discardNotes` flag. A contact links once: linking an already-linked contact is rejected. Resolved.
- "Not them" only hides the match prompt on the open page; nothing is stored, so the prompt returns on the next visit and the lead can still link (`L2-015` AC4).
- The contact reports a `match` (the member's profile id and name) while it is unlinked and a verified account uses its email; join dates are not stored, so the mocks no longer show one.
