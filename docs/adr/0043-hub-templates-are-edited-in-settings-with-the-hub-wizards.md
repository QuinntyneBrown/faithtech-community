# 0043. Hub templates are edited in Organisation settings with the hubs' own section wizards

- Status: Accepted
- Date: 2026-11-02
- Requirements: L1-008, L2-184 to L2-187
- Designs: `docs/detailed-designs/events/edit-hub-templates`
- Proposal: `docs/proposals/event-hubs.md` (open question 3)
- Refines: ADR 0041 (templates are JSON rows), ADR 0033 (capabilities)

## Context

Slice 45 stored templates as organisation rows and seeded FaithTech's three. Slice 47 lets an organisation edit them.
Four things had to be settled: who may edit them, where the editor lives when the Organisation settings tabs belong to the
`organisations` library and the section wizards to the `events` library, how a default Agenda is edited when a template
knows no event, and which sections can hold default text at all.

## Decision

- **Holders of `ManageOrganisationSettings` edit templates; chapter leads do not** (open question 3). A template shapes
  every chapter's hubs, so it is an organisation setting like event types. `ManageEventHubs` alone gets 403. Holders of
  `ManageRoles` see the tab read-only, as they see every other settings tab (`L2-147`). `AdministerOrganisation` holds
  every capability, as before.
- **The editor is an `events` page mounted under Organisation settings by the app shell.** `organisations` exports
  `organisationRoutes(extra)`; the shell passes a `hub-templates` child that lazy-loads the templates pages from
  `@faithtech-community/events`. The Organisation page only links the tab by URL. Neither library imports the other, and the
  twenty section wizards stay where they are instead of moving into `components` (they hold business rules and call `api`).
- **The wizards save through the data they are opened with.** `HubSectionWizardData` gains an optional `template`: its name
  and a `save(kind, content)` function. A wizard opened for a template saves through it, hides the Preview link and the
  event's facts, and says it edits a default. The hub's own wizards behave exactly as before.
- **A template Agenda is edited against a 9:00 am start and stored in minutes.** The template page builds a stand-in event
  that starts at 9:00 am local time on the day it opens; the Agenda wizard works on instants as always, and the save turns
  each row into minutes from that start. The API stores and validates minutes (0 to 10,080), keeping ADR 0041's shape.
- **Only typed text has a default.** Hero, Agenda, What to bring, Tracks, Process, Rules, Demo format, Judging and honors,
  Worship, Giving and Upcoming events take default content, validated by the hub's own validators. Venue, Parking,
  Partners, People, Submission and feedback and Slides name an event's venue, members, partners, forms or files, so each
  hub fills them in; saving a default for them is 400.
- **Templates are archived, never deleted**, like event types. An archived template leaves the wizard and cannot be
  applied, and comes back at the end of the list when restored. Every change is audited as `hub_template.updated` in the
  organisation audit log's Stages & types category.
- **Hubs copy, never link.** Applying a template copies its sections (ADR 0041), so editing, renaming or archiving it
  never changes a hub. Nothing new is needed to keep that true; tests pin it.

## Consequences

- A provisioned organisation can now make its own templates (`L2-171` AC3 still gives it none at first).
- A new section kind with typed text only needs its wizard listed as editable on the template page.
- Template agenda times read as 9:00 am based; an organisation whose events start in the evening sees 9:00 am rows in
  the editor. The note in the wizard says so; each hub moves them to its event's start.
- Reordering templates is not offered; new and restored templates go to the end. It can follow if organisations ask.

## Alternatives considered

- **Move the wizards into `components`.** Rejected: they call `EVENT_HUBS_SERVICE` and hold section rules, which
  `components` must not.
- **Put the editor in `organisations` and duplicate simple text forms.** Rejected: two editors per kind would drift, and
  the proposal says the same wizards edit templates.
- **Let `ManageEventHubs` edit templates.** Rejected: a chapter lead's edit would change every chapter's next hub.
- **Store template agenda rows as clock times.** Rejected: ADR 0041 chose minutes so a template works for any start.
