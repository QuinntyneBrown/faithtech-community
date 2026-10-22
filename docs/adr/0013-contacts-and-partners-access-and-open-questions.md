# 0013. Contacts and partners: access, matching and the open questions

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-012, L2-013, L2-014, L2-015, L2-016, L2-017, L2-018, L2-042
- Designs: `docs/detailed-designs/contacts/*`, `docs/detailed-designs/partners/*`

## Context

The contacts and partners designs left several points `<TO SUPPLY>`: which lead roles own contacts and edit partners, the note length, whether notes can be edited, what "Save and link" checks, what "Not them" stores, how a partner owner is chosen, where a partner is edited, and how the board looks on a phone. The mocks also had an inline note form on the contact and partner pages, which `AGENTS.md` forbids, and no partner edit screen.

## Decision

Access

- A **lead role** is City Lead, Event Lead, Create Lead or Communications Lead, as for invites (ADR 0006).
- Contacts: any lead role or System Admin may list and create contacts. Everyone else, Staff included, gets `403` for the list and for create (the contacts page shows its forbidden state). A request for one contact, its notes or any change to it answers `404` unless the caller owns it or is a System Admin (L2-042 AC2). The list and search only ever return the caller's own active contacts, System Admin included; an admin opens another lead's contact by its link.
- Every System Admin access to a contact they do not own, read or change, writes an audit entry (`contact.viewed`, `contact.updated`, `contact.notes-viewed`, `contact.note-added`, `contact.archived`, `contact.restored`, `contact.linked`, `contact.deleted`), target type `Contact`.
- Partners: any lead role, Staff or System Admin may read the board, a partner and the owner list. Lead roles and System Admin may create, edit and move. Staff get `403` for writes; anyone else gets `403` for every partner endpoint (L2-017 AC3, AC4). An unknown partner id is `404`.
- A System Admin who holds no lead role changes the pipeline by admin right, so their creates, edits and moves are audited (`partner.created`, `partner.updated`, `partner.moved`, target type `Partner`). A lead's changes are recorded in the partner's own stage history instead.

Contacts

- Search is a case-insensitive substring match on name, email, organisation and note text, built into the database query (L2-042 AC3). Archived contacts are left out.
- A note is 1 to 2,000 characters. Notes are append-only; editing and deleting single notes stay deferred. The form's "First note" becomes the contact's first note on create and is not shown when editing.
- The contacts list is a list of cards at every width, as the mock shows; there is no table.
- **Save and link** (L2-013 AC6): `POST /api/contacts` with an email that belongs to a verified member answers `409` with `memberName` and saves nothing, unless the request says `linkToMember: true`, in which case the contact is created already linked to that member. Only verified accounts match, so an unverified sign-up is never revealed.
- **Sign-up match** (L2-015): when an account's email becomes verified (the verify-email link, or accepting an invite with a new account), every active, unlinked contact with that email, compared case-insensitively, gives its owner an in-app `ContactSignedUp` notification linking to `/contacts/{id}` and an email. The contact then reports the member as a `match` until it is linked.
- **Not them** only hides the match prompt on the page the lead is looking at. Nothing is stored, so the prompt is there again next time and the lead can still link (L2-015 AC4).
- `POST /api/contacts/{id}/link` takes `profileId` and `discardNotes`; the profile must exist (`404`) and a contact links once (`409`). A linked contact shows the profile's name and featured photo; notes stay private.
- Archived contacts never expire. Only an archived contact can be deleted (`409` otherwise); the delete removes its notes by cascade.
- Profiles are not deleted in v1 (members are suspended), and a contact links once, so a deleted linked profile and an email that moves between accounts are deferred.

Partners

- A partner's owner is optional and must be a member holding a lead role (`400` otherwise). `GET /api/partners/owners` lists those members for the owner select.
- Add partner is a dialog with every L2-017 field; **Edit** navigates to a new partner form page, `/partners/:id/edit` (mock `pages/partner-form`). The stage is not edited there; it changes only by a move.
- The partner page shows the stage history, newest first, with who moved it, from and to, and the note. Its partner notes are the `Notes` field, edited on the form; the mock's inline note form is removed.
- Moves go from any stage to any other; moving to the current stage is `409`. Two leads moving at once: last write wins, with no concurrency token.
- On phones, below the design system's `sm` breakpoint (640px, which covers XS), the board shows the stages as tabs with one column at a time (L2-018 AC4, mock `pages/partners/tabs`), composed from the library's tabs and Kanban components.

Mocks

- The contact page gets an **Add note** button that opens a new `AddNoteDialog` (mock `dialogs/add-note`), replacing the inline form. The contact form gains City.
- Join dates are not stored, so the link dialog and match prompt no longer show one; list rows show organisation and city.

## Consequences

- Visibility is decided in one place per feature (`ContactAccess`, `PartnerAccess`) and enforced in every handler; tests cover each role.
- "Save and link" lets a lead learn whether an email belongs to a verified member. Leads are trusted roles and the answer names the member only, so this is accepted.
- No demo seed data is added: contacts belong to real leads, and the seeder only seeds reference data. Partner demo data is deferred.
