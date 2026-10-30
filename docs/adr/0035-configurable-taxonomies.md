# 0035. Configurable taxonomies replace the PartnerStage, EventType and resource type enumerations

- Status: Accepted
- Date: 2026-10-30
- Requirements: L1-028, L2-144 to L2-146, L2-017, L2-018, L2-020, L2-021, L2-049, L2-055, L2-059, L2-125, L2-126
- Designs: `docs/detailed-designs/organisations/taxonomies`, `docs/detailed-designs/partners/partner-kanban-board`, `docs/detailed-designs/events/create-and-edit-events`, `docs/detailed-designs/resources/add-and-edit`
- Proposal: `docs/proposals/organisations.md`
- Refines: ADR 0028 (partner merge and restore), ADR 0030 (report metric definitions)

## Context

The partner pipeline has three fixed stages, events five fixed types and resources seven fixed types, each a Domain enumeration with a hard-coded label, column or filter chip. Another organisation's pipeline is "Prospect, Proposal, Signed", its events are "Meet-up" and "Retreat", and its resources need a "Policy" type.

## Decision

- Three **per-organisation ordered lists** in `Domain/Organisations/`: `PartnerStage`, `EventType`, `ResourceType`. Each entry has a key (stable, used in URLs, history and the seed), a name, a sort order and an archived flag. Entries are archived, never deleted, once referenced, and archived entries leave pickers and filters while staying on the records that hold them.
- `PartnerStage` adds `IsInitial` (exactly one active stage) and `Kind` (Open or Confirmed) so that a new partner has a stage, and Home's pipeline card and the Reports "confirmed" figure (ADR 0030) count by kind rather than by name. The Kanban board renders one column per active stage in order (tabs on XS); moving a partner records stage keys in its history; a partner left on an archived stage keeps it until moved.
- `EventType` has no extra field. The event list filters by type; the fixed "Hackathons" chip becomes the type filter with the organisation's types.
- `ResourceType` has no extra field. The type guessed from an upload's extension maps by key to the organisation's list, falling back to the entry keyed `other`, which every organisation keeps.
- The lists are read by every member through `GET /api/organisation` and changed by holders of `ManageOrganisationSettings` on the Stages & types page, audited under `taxonomies`.
- FaithTech seed: stages Lead (initial), In Funnel, Confirmed (kind Confirmed); event types Gathering, Builders night, Hackathon, Prayer & planning, Panel; resource types Deck, Logo, Image, Training, Template, Document, Other.

Rejected: free-text stages and types (no ordering, no columns, no stable keys for history and merge); a generic "lists" feature (the SharePoint review already rejected unmodelled lists).

## Consequences

- `Partner.Stage`, `Event.Type` and `Resource.Type` become references to list entries; migrations map today's enumeration values to the seeded keys.
- The merge dialog (ADR 0028) compares stages by key; the stage history and the "Merged" entries are unchanged in shape.
- Columns, chips and pickers in `components` take their options as data; nothing in `components` knows a stage name.
