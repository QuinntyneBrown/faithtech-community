# 0023. Notes: block storage, ordering and concurrency

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-022, L2-086, L2-087, L2-089, L2-090, L2-094, L2-096
- Designs: `docs/detailed-designs/notes/pages-and-list`, `docs/detailed-designs/notes/block-editor`, `docs/detailed-designs/notes/links-and-backlinks`, `docs/detailed-designs/notes/archive-and-search`
- Refines: ADR 0016

## Context

A Docs & notes page (L1-022) is a title, an icon and an ordered list of up to 500 blocks, each with rich-text spans or block-specific fields. The owner edits it with autosave; readers see it read-only; global search matches its text; backlinks need to know which pages link to which. Only the owner (or a System Admin) edits, and real-time co-editing is deferred (`docs/proposals/notes.md`).

The design had to settle how blocks are stored, how their order is kept, how two saves of the same page are kept from silently overwriting each other, how backlinks are found without parsing every page, and what search indexes.

## Decision

### Blocks are one JSON document on the page row

- `NotePage.Content` holds the whole block list as a JSON array, serialised by `NoteContent` from the `NoteBlock` and `NoteSpan` records with `System.Text.Json`, camelCase names and nulls omitted. The column is `text`: nothing queries inside it, and `text` behaves the same in PostgreSQL and the EF Core in-memory provider the backend tests use.
- The server validates the document on every save (`NoteBlocksValidator`: types, limits, URL schemes, alt text, image ownership) and refuses the whole save on any error, so the stored shape is always one the editor can render. The only rewrite on save is clearing the text of page-link spans.
- Rejected: **a `NoteBlocks` table** (one row per block). It would turn every keystroke-driven save into a multi-row diff, need an order column, and cost a join on every read, for no query that needs a single block. Rejected: **per-block operations** (`POST /blocks`, `PATCH /blocks/{id}`, `move`). They pay off only when several people edit one page at once, which is deferred, and they multiply endpoints, validation paths and fake-backend work.

### Whole-page saves; order is array order

- `PUT /api/notes/{id}` carries the title, icon, the full ordered block list and the version it started from. The array order is the page order; a move is a save with the block at its new index.
- Rejected: **fractional indexing** (a sortable key per block so concurrent inserts do not collide). It solves a co-editing problem that single-owner editing does not have, and it would need periodic rebalancing.
- A full page is at most 500 blocks of 10,000 characters; in practice a save is a few kilobytes. The editor sends at most one save at a time, 800 ms after the last change.

### Integer version with 409 on conflict

- `NotePage.Version` starts at 1 and increments on every content save; sharing, moving, archiving and image uploads leave it alone, so they never cause a conflict. A save names the version it was based on; a mismatch answers `409` with `currentVersion`, `updatedByName`, `updatedByYou` and `updatedAt`, and nothing is overwritten. The client stops autosaving and shows the conflict banner with *Reload page*.
- `Version` is also an EF Core concurrency token, so two requests that pass the check at the same moment cannot both commit; the loser maps to the same `409`.
- Conflicts arise between two tabs or devices of the owner, or between the owner and a System Admin override.
- Rejected: **last write wins**. It silently loses work from the other tab. Rejected: **an ETag over the block content** (`If-Match`). A hash is costlier to compute than an integer, says nothing a reader can show ("saved by … at …"), and the integer already serves as a validator.

### Links table rebuilt on save

- `NoteLinks (SourceId, TargetId)` holds one row per distinct page linked from a page. Every save brings the source's rows in line with its current page links (removing the dropped ones, adding the new ones), in the same transaction as the content, skipping self-links and ids that match no page.
- Page-link spans are stored with empty text; the title is filled at read time (ADR 0025).
- Backlinks are one indexed query on `TargetId`, joined to the visibility predicate, with no JSON parsing.

### Body text for search

- `BodyText` is derived on save from the text of every text-bearing block, leaving out page-link spans, plus link-card captions, joined with line breaks. Image alt text is not included, and linked pages' titles never are (ADR 0025).
- `SearchVectors` adds a generated, GIN-indexed `SearchVector` over `Title` and `BodyText` (ADR 0016), so a save is searchable at once with no reindex job; archive and restore act through the visibility predicate. The Notes list's search box matches the same document.

## As built

Implemented as decided, in one migration (`20261022160730_Notes`). `NoteImages` is its own table keyed by `PageId`, and the share rows carry a generated key so rows added to a loaded page insert. Text over the `tsvector` limit is not truncated; the 500-block and 10,000-character limits keep a page well inside it.

## Consequences

- A save rewrites the whole `Content` value; at community scale this is cheap, and it keeps the client, the API and the fake backend simple.
- Moving to co-editing later means replacing whole-page saves with operations and adding an ordering scheme; the JSON block shape and block ids carry over.
- The conflict path discards nothing on the server; the member decides what to keep after reloading.
- `BodyText` duplicates text already in `Content`. That is the price of indexing plain text without parsing JSON in SQL.

## Deferred

Real-time co-editing and presence, per-block operations, version history, and merging a conflicting save.
