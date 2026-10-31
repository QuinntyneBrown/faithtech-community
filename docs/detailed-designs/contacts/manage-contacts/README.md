# Manage private contacts

## Overview

Holders of `KeepContacts` (seeded on the lead roles in FaithTech) meet people who have not yet joined {organisation name}. A **private contact** — record of such a person, owned by the member who created it and visible only to that owner and, as an audited override, to a holder of `AdministerOrganisation` (`L2-135` AC5). Private contacts are the one exception to the rule that an organisation's data is shared by every member. A holder of view-only capabilities, who can read everything else, cannot see them.

This feature covers listing, creating, editing and searching contacts, and the visibility rule that every contact query enforces. Notes, linking on sign-up and archiving are separate slices in the contacts subsystem that rely on the same visibility rule.

## Description

The slice runs from the contacts pages in the web app to the `Contacts` and `ContactNotes` tables in the Community database.

- **`ContactsPage`** — page in the `contacts` feature library at `/contacts`. It shows the caller's active contacts as a grid of person cards — one column on phones, two from 640px, four from 1024px — each with a cover band, the featured photo or initials, the name, a Private, Signed up or Member badge, organisation and city, a notes-or-added line, a *View profile* link and an × that opens the archive confirmation ([contact photos](../contact-photos/README.md), `L2-072`, `L2-073`), with a search field, an alert for the first contact who signed up, an empty state that invites the owner to add one, and a forbidden state when the API answers `403`. It links to Add contact (`/contacts/new`) and Archived contacts (`/contacts/archived`).
- **`ContactPage`** — detail page at `/contacts/:id`. It loads the contact and its notes together and shows a not-found state on `404`. When `isOwn` is false (an administrator opening another member's contact) the subtitle says the access is recorded. Its Details card is an `ft-description-list`; the email is a `mailto:` link, and an optional fact with no value (email, phone, organisation, city) keeps its row and reads "Not added" through `ft-description-list-item [missing]` (mock `pages/contact/missing`). While the contact loads, the card keeps its terms and shows skeleton values through `ft-description-list [loading]` (mock `pages/contact/loading`).
- **`ContactFormPage`** — create and edit screen at `/contacts/new` and `/contacts/:id/edit` with name (required), email, phone, organisation, city (free text labelled "City" whatever the organisation's chapter label, `L2-141` AC4), a first note and a photo picker (both create only; the picker is `ft-picture-list` with `subject="contact"`, `L2-067`). Client checks mirror the validator; inline errors, an error summary and focus on the first invalid field follow both client and `400` errors. A `409` that carries `memberName` turns the save into "Save and link": the next save sends `linkToMember: true`, and changing the email clears it. Editing navigates to this screen rather than editing inline.
- **`ContactsService`** / **`CONTACTS_SERVICE`** / **`HttpContactsService`** — API client contract, injection token and HTTP implementation in `api/src/lib/contacts`. `list(term)`, `get(id)`, `create(contact)` and `update(id, contact)` call `GET /api/contacts?q=`, `GET /api/contacts/{id}`, `POST /api/contacts` and `PUT /api/contacts/{id}`.
- **`ContactsEndpoints`** — minimal API mapping in `FaithTech.Community.Api`; it holds no business logic. The list answers `200` or `403`; create answers `201`, `400`, `403` or `409` with `memberName`; get answers `200` or `404`; update answers `200`, `400` or `404`. Request bodies are validated by the `Validate<T>()` endpoint filter before the handler runs.
- **`CreateContactCommand`** (`Name`, `Email`, `Phone`, `Organization`, `City`, `Notes`, `LinkToMember`) and **`UpdateContactCommand`** (the same details without the note and link flag) — request bodies.
- **`CreateContactValidator`** / **`UpdateContactValidator`** — share **`ContactRules.Details`**: a name is required ("Enter at least a first name.", at most 200 characters), an email must be well formed when present (at most 256), and phone, organisation and city are at most 200 characters. The first note is at most 2,000.
- **`ManageContactsHandler`** — Application handler in `Contacts/` with `CreateAsync`, `GetAsync`, `UpdateAsync`, `ListAsync(term)` and `ListArchivedAsync` (used by `contacts/archive-restore-delete-contacts`). `CreateAsync` makes the caller the owner, adds the first note and, through `ContactViews.MatchAsync`, answers `Result.Conflict` with a `memberName` extension when a verified member uses the email, unless `LinkToMember` is set, in which case the contact is created already linked.
- **`ContactAccess`** — Application permission check. `CanKeepContacts` is `ICurrentUser.Has(Capability.KeepContacts)`. `AuthorizeAsync(contactId, withNotes)` loads the contact and returns a **`ContactAccessKind`**: `Owner`, `AdminOverride` (the caller is not the owner and holds `AdministerOrganisation`, the `AuthorizationRules.IsOverride` case) or `NotFound`. A non-owner, non-administrator caller receives `404`, never `403`, so existence is not revealed. `AuditOverride(...)` records an audit entry through `IAuditLog` only for `AdminOverride` (`L2-012` AC2, `L2-135` AC5), for example `contact.viewed` and `contact.updated` with the before and after details.
- **`ContactViews`** — builds **`ContactDto`**: once linked, the name and featured photo come from the profile; while unlinked, `Match` (**`ContactMatchDto`**) names the verified member who uses the email. It also counts the notes.
- **`ContactSummaryDto`** — a list row with `Status` `Private`, `SignedUp` (a verified member uses the email) or `Member` (linked), plus `PhotoUrl`, `PhotoAltText`, `NoteCount` and `CreatedAtUtc` for the person card.
- **`ICurrentOrganisation`** — every query is scoped by the DbContext's global filter on `ICurrentOrganisation`, so a contact id from another organisation answers `404` (`L2-130` AC3).
- **`Result.Extensions`** — `Result.Conflict(detail, extensions)` carries extra problem-details fields, which `ResultMapper` writes into the `409` response (here `memberName`).
- **`Contact`** — Domain entity stamped with `OrganisationId` and owned by `OwnerId`, with `Name` (required), `Email`, `Phone`, `Organization` and `City`, which stays free text because a contact is an outsider and the city is a postal fact, not a chapter (ADR 0034); `Update(...)` edits the details but never the owner. `CommunityDbContext` maps it to `Contacts` with an index on owner and archive time.
- **List and search** — `ManageContactsHandler.ListAsync` filters, case-insensitively, on name, email, organisation or note text with an `OwnerId = caller` and `ArchivedAtUtc IS NULL` predicate in the database query, meeting the 500 ms target. Global search, when built, must apply the same owner predicate.

Who may own contacts: any holder of `KeepContacts`; everyone else gets `403` for the list and create, and `404` for a single contact ([ADR 0014](../../../adr/0014-contacts-and-partners-access-and-open-questions.md), refined by ADR 0033).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-012` | `L1-005` | Private contact visibility |
| `L2-013` | `L1-005` | Create, edit and search contacts |
| `L2-135` | `L1-026`, `L1-015` | Capability catalogue and server authorisation |

### Acceptance criteria

**`L2-012` — Private contact visibility**

1. Given a contact created by a holder of `KeepContacts`, when any other member, whatever their capabilities short of `AdministerOrganisation`, requests it by page, API or search, then it is not returned (404 for a direct request).
2. Given a holder of `AdministerOrganisation`, when they request any contact, then it is returned as an override, and an audit entry is written (`L2-135` AC5).
3. Given the owning member, when they list contacts, then only their own contacts appear.

**`L2-013` — Create, edit and search contacts**

1. Given a holder of `KeepContacts`, when they create a contact with a name and an optional email, phone, organization, city (free text labelled "City" whatever the organisation's chapter label, `L2-141` AC4) and notes, then it appears in their contact list.
2. Given a contact without a name, or with an invalid email, when the owner saves, then inline errors are shown.
3. Given a search term, when the owner filters their contacts, then the list shows matches on name, email, organization or their notes within 500 ms.
4. Given a holder of `KeepContacts` with no contacts, when they open the contacts page, then an empty state invites them to add one.
5. Given an XS viewport, when the contacts page is shown, then the contacts appear as a single column of person cards instead of a table (`L2-072`).
6. Given a new contact whose email belongs to an existing member of the organisation, when the owner saves, then they are offered "Save and link" to link the contact to that profile.

**`L2-135` — Capability catalogue and server authorisation**

1. Given the platform, when `GET /api/organisation/capabilities` is called by any member, then it lists exactly: `ManageEvents`, `ViewAttendees`, `ManageAttendance`, `KeepContacts`, `ViewPartners`, `ManagePartners`, `InviteMembers`, `ConnectLink`, `OwnWorkspaces`, `JoinWorkspaces`, `ReadAllWorkspaces`, `ViewPeopleDirectory`, `AssignRoles`, `SendAnnouncements`, `AddResources`, `ViewReports`, `ManageRoles`, `ManageOrganisationSettings`, `AdministerOrganisation`, each with a one-line description, and no organisation can add, rename or remove one.
2. Given a request, when the server authorises it, then it checks the caller's capabilities, computed on that request from the union of the capabilities of every non-archived role the caller's profile holds in the current organisation, and never compares a role name.
3. Given a holder of `AdministerOrganisation`, when any capability is checked, then it is held.
4. Given an action that needs a capability the caller lacks, when it is called, then the response is 403 (or 404 where `L2-042` AC2 hides existence), and nothing changes.
5. Given an action the caller is allowed only because they hold `AdministerOrganisation` (they lack the specific capability, or do not own the record), when it succeeds, then it is an override and an audit entry is written (`L2-041`); given the caller holds the specific capability or owns the record, then it is not audited (role changes excepted, `L2-138` AC5).
6. Given every signed-in member of the organisation, when they view profiles, the team, events and announcements, RSVP, open resources and notes visible to them, create their own notes, search, or edit their own profile and settings, then no capability is required.
7. Given the frontend, when it decides what to show, then it reads capabilities from `/api/me`, never role names, and hiding is a convenience only: the server refuses what the member may not do.

## Diagrams

### System context

Holders of `KeepContacts` manage their own contacts; an administrator may open and edit any contact by its link, and each such access is audited. No external system takes part.

![C4 system context for manage private contacts](diagrams/c4-context.png)

### Containers

The `contacts` feature library in the Angular web app calls the Community API through the `api` library over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for manage private contacts](diagrams/c4-container.png)

### Components

The three pages call `HttpContactsService`, which reaches `ContactsEndpoints`. The validators reject bad bodies with `400`; `ManageContactsHandler` checks `ContactAccess`, builds DTOs through `ContactViews` and saves through `CommunityDbContext`. `ContactAccess` records admin overrides in `AuditLog`.

![C4 component view for manage private contacts](diagrams/c4-component.png)

### Class structure

`Contact` composes its `ContactNote` entries. `ManageContactsHandler` depends on `ContactAccess` and `ContactViews`; `ContactAccess` decides a `ContactAccessKind` from `ICurrentUser.Has`, `ICurrentOrganisation` and the contact's `OwnerId`, and audits through `IAuditLog`.

![Class diagram for manage private contacts](diagrams/class-structure.png)

### Behaviour — create a contact

The validator rejects a missing name or malformed email with `400` before the handler runs. A caller without `KeepContacts` gets `403`. An email that belongs to a verified member answers `409` with `memberName` until the owner chooses "Save and link"; a valid contact is owned by the caller.

![Sequence diagram for create a contact](diagrams/sequence-create-contact.png)

### Behaviour — list and search contacts

`ManageContactsHandler.ListAsync` is always scoped to the caller's active contacts, so other members' contacts never appear (`L2-012` AC3), administrators included.

![Sequence diagram for list and search contacts](diagrams/sequence-list-and-search.png)

### Behaviour — get a contact

`ContactAccess.AuthorizeAsync` answers `NotFound` for anyone but the owner and a holder of `AdministerOrganisation`, so a direct request returns `404`. An administrator is granted access as an override and `contact.viewed` is audited.

![Sequence diagram for get a contact](diagrams/sequence-get-contact.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `L2-013` adds a city to a contact; `Contact.City` is added to match. Resolved.
- Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.

Decisions recorded while building the feature ([ADR 0014](../../../adr/0014-contacts-and-partners-access-and-open-questions.md)):

- The contacts list is cards at every width rather than a table that turns into cards at XS (`L2-013` AC5). Since `L2-072` the cards are person cards in a 1/2/4-column grid ([ADR 0017](../../../adr/0017-contact-photos-private-images-and-person-cards.md)).
- The list and search return only the caller's own contacts, administrators included; every administrator access to another member's contact is audited.
- Capabilities: `CanKeepContacts` was a role-name check through `LeadRoles`, which is deleted; it is now `KeepContacts`, and `AdminOverride` is the `AdministerOrganisation` override (ADR 0033).
- "Save and link" matches verified accounts only.
- The owner's own reads and changes are not audited; only `AdminOverride` access writes an audit entry, with target type `Contact`.
