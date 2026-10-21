# Contact notes

## Overview

A **contact note** — timestamped free-text entry a lead records against one of their private contacts. Notes hold the lead's own observations and follow-ups. They share the contact's visibility: only the owning lead and System Admin may read them.

Notes remain private even after the contact is linked to the person's real profile (`contacts/link-contact-on-sign-up`); linking shows the profile's name and photo on the contact but never exposes the notes to the person or anyone else.

## Description

- **`ContactPage`** — contact detail page in the `contacts` feature library. It lists notes newest first and offers an Add note button that opens `AddNoteDialog` (no inline form, `AGENTS.md`).
- **`AddNoteDialog`** — CDK dialog with a single required text area. A note is 1 to 2,000 characters (mock `dialogs/add-note`).
- **`ContactsService`** — `addNote(contactId, body)` and `getNotes(contactId)` calling `POST` and `GET /api/contacts/{id}/notes`.
- **`ContactsEndpoints`** — maps the notes routes.
- **`AddContactNoteCommand`** / **`AddContactNoteHandler`** and **`GetContactNotesQuery`** / **`GetContactNotesHandler`** in Application `Contacts/`. Both use `ContactAccessPolicy`; non-owners receive `404`, and System Admin access is audited.
- **`ContactNote`** — Domain entity with `Body` (required) and `CreatedAtUtc`, composed by `Contact` and created only through `Contact.AddNote(body, nowUtc)`.

Notes cannot be edited or deleted after creation; `L2-014` defines only adding and reading ([ADR 0007](../../../adr/0007-contacts-and-partners-access-and-open-questions.md)).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-014` | `L1-005` | Contact notes |

### Acceptance criteria

**`L2-014` — Contact notes**

1. Given a contact, when the owning lead adds a note, then it is saved with a timestamp and shown newest first.
2. Given a contact linked to a real profile, when the lead views it, then their private notes are still shown, and are visible only to them and System Admin.

## Diagrams

### System context

The owning lead writes and reads notes; a System Admin may read them by override.

![C4 system context for contact notes](diagrams/c4-context.png)

### Containers

The `contacts` feature library in the Angular web app calls the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for contact notes](diagrams/c4-container.png)

### Components

Both note handlers apply `ContactAccessPolicy` before reading or writing any note.

![C4 component view for contact notes](diagrams/c4-component.png)

### Class structure

`Contact` composes `ContactNote`. The note handlers depend on `ContactAccessPolicy`.

![Class diagram for contact notes](diagrams/class-structure.png)

### Behaviour — add a note

The note is saved with a UTC timestamp and appears at the top of the list (`L2-014` AC1).

![Sequence diagram for add a note](diagrams/sequence-add-note.png)

### Behaviour — read notes

Notes are returned newest first, including on a contact linked to a real profile (`L2-014` AC2).

![Sequence diagram for read notes](diagrams/sequence-read-notes.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- Notes are append-only in the Domain; editing and deleting single notes stay deferred until a requirement defines them.
- The contact page's inline note form in the original mock is replaced by an Add note button and `AddNoteDialog`; the contact form's first note becomes the first `ContactNote` on create.
