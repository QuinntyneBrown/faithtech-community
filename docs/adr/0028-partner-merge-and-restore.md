# 0028. Partner merge semantics and restore

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-114, L2-115, L2-111
- Design: `docs/detailed-designs/partners/duplicate-detection-and-merge`, `docs/detailed-designs/partners/partner-activity-timeline`

## Context

When two partner records describe the same organization (ADR 0027), leads need one record that keeps everything both records knew: field values, notes, logged activities and stage history. A merge is a large change made by one lead to shared data, so it must not silently lose information, must not run on data that changed while the lead compared the records, and must be reversible by someone accountable. Until now partner writes were last-write-wins with no concurrency token (ADR 0014), and partners were never removed.

## Decision

- **Keep one, archive the other.** `POST /api/partners/{keepId}/merge` names the kept record in the route and the other in the body. The kept record takes a value per differing field (name, stage, contact name, email, phone, website, offering, owner) chosen as `keep` or `other`; a missing choice means `keep`. Notes are not chosen: the kept record's notes come first, then the other's. Joined notes over the 2,000-character limit are refused with `400` rather than truncated.
- **Rows move, and remember where they came from.** Every `PartnerActivity` and `PartnerStageChange` of the other record moves to the kept record and records `MergedFromPartnerId`, set only when empty, so a row keeps its first record through a chain of merges. A system `Merged` activity ("Merged {other} into {kept}") is written on the kept record and carries the stage change, if any; the merge adds no `PartnerStageChange`.
- **Archive, never delete.** The other record gets `ArchivedAtUtc`, `MergedIntoId`, `MergedById` and `MergedAtUtc`. Archived partners are left out of the board, global search, duplicate checks and Reports, and cannot be edited, moved or logged against. Their page still answers and shows who merged them, when and into which partner.
- **Optimistic concurrency for merge and restore.** `Partner.Version` is an integer concurrency token incremented by every edit, stage move, merge and restore. The merge body carries the version of each record the lead saw; restore carries the archived record's and the kept record's. Any mismatch answers `409` and changes nothing; a race caught by the token at `SaveChanges` answers the same. Edits and stage moves still do not send a version and stay last-write-wins.
- **Access.** Lead roles and System Admin merge; Staff and everyone else get `403`. Every merge is audited (`partners.merged`, the spec's `PartnersMerged`) whoever performs it, with both records' snapshots and the choices. Restore is System Admin only (`POST /api/partners/{id}/restore`) and always audited (`partner.restored`, the spec's `PartnerRestored`).
- **Restore.** Clears the archive fields, moves back every activity and stage change whose `MergedFromPartnerId` is the restored record (wherever it now lives) and clears that field, and writes a system `Restored` entry on both records. The kept record keeps the values and joined notes the merge gave it. Restoring a record whose kept record is itself archived answers `409` until that one is restored.
- Everything a merge or restore changes is saved in one `SaveChanges` with its audit entry.

## Consequences

- No information is lost by a merge, and a mistaken merge can be reversed for the moved rows by a System Admin.
- Restore is partial by design: the kept record's chosen values and joined notes stay; a lead tidies them by hand, guided by the Restored entry and the audit log's before values.
- In a chain A into B into C, restoring B returns only rows first written on B; A's rows return when A is restored.
- The `409` path needs a failed state in the merge dialog with "Reload and try again"; leads who compare slowly on a busy partner may see it.
- Partner reads must filter `ArchivedAtUtc is null` wherever partners are listed or counted; a new list that forgets the filter shows merged partners. The integration tests for the board, search, duplicates and Reports cover it.
- ADR 0014's last-write-wins rule still holds for edits and moves; only merge and restore check versions.
