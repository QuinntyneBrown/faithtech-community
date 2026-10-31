# 0034. Chapters are organisation-labelled tags and filters, never data boundaries

- Status: Accepted
- Date: 2026-10-30
- Requirements: L1-027, L2-140 to L2-143, L2-006, L2-019, L2-020, L2-021, L2-053, L2-082, L2-124
- Designs: `docs/detailed-designs/organisations/chapters`, `docs/detailed-designs/team/team-list`, `docs/detailed-designs/events/event-list-and-filter`, `docs/detailed-designs/reports/reports-dashboard`
- Proposal: `docs/proposals/organisations.md`
- Refines: ADR 0007 (team filters), ADR 0015 (team paging), ADR 0030 (report metric definitions)

## Context

"City" is free text in three places (`Profile.HomeCity`, `Contact.City`, `Event.City`) and a filter in four (team, events, people, reports). The seeded City Lead role has no city of its own; a lead's city is their home city. The data rule has always been "global with no city boundary". An organisation may have campuses, regions, branches, or nothing of the kind, and may want a role that is held *for* a chapter.

## Decision

- **Optional, single level, labelled.** `Organisation.ChapterLabel` (singular and plural) turns chapters on; null turns every chapter control and filter off. `Chapter` (`Domain/Organisations/`) has a name unique within the organisation, a sort order and an archived flag. No hierarchy.
- **Tags, not boundaries.** `Profile.ChapterId` (optional) replaces `HomeCity`; `Event.ChapterId` (optional, none = organisation-wide) replaces `Event.City`. Nothing is hidden by chapter. Every list, search and report stays organisation-wide and gains "All {Cities}" plus the active chapters as its filter. `Contact.City` stays free text: a contact is an outsider and the field is a postal fact. A partner has no chapter and keeps counting under its owner's chapter in reports (ADR 0030).
- **Role assignments may be chapter-tagged** when the definition is `ChapterScopable` (`ProfileRole.ChapterId`). The tag shows on badges ("Event Lead · Toronto") and the connect page ("City Lead · Toronto"). Its only rule is on granting: a grantor whose own grantor role is chapter-tagged may add and remove only assignments tagged with one of their chapters; an untagged grantor may grant anywhere; `AdministerOrganisation` is never scoped.
- **Archived chapters** stay on the records that reference them, leave pickers and filters, and are never deleted.
- **Migration** for FaithTech: one chapter per distinct trimmed, case-folded `HomeCity` and `Event.City`; exact matches mapped; the rest set to none and written to the migration log. The seeder's "City NN" demo values become seeded chapters.

Rejected: chapters as a visibility boundary (every design relies on organisation-wide data, and a lead in two cities is common); hierarchical chapters (multiplies filters and scoping rules for a need no one has stated); keeping free text (cannot be filtered reliably, cannot be labelled, cannot scope a grant).

## Consequences

- `IX_Profiles_HomeCity` (ADR 0030) becomes an index on `ChapterId`; the report's city list is the chapter list.
- Team, events, people and reports pages read the filter options from `GET /api/organisation`; the fake does the same.
- Chapter-targeted announcement audiences and chapter pages are deferred and can be added without changing the model.
