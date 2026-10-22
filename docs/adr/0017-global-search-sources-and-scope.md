# 0017. Global search sources, scope and full-text query

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-026
- Designs: `docs/detailed-designs/search/global-search`

## Context

L2-026 groups results into people, events, partners, contacts and work items, filtered by what the caller may open, using Postgres full-text search, with p95 under 500 ms at 100,000 records. Profiles, contacts, partners and Agile work items are stored; events are not yet. Backend tests must not need Postgres, yet the permission filtering is the part that most needs proving. The design left the per-group limit open.

## Decision

- **One source per kind.** `ISearchSource` (Application, `Search/`) has a `Kind` and `SearchAsync(term, scope, limit)`. People, partners, contacts and work items each have one. `GlobalSearchHandler` asks every registered source in the order people, events, partners, contacts, work items, and leaves out empty groups. Events add a source when the events feature stores them.
- **Permission filters live in Application.** Each source narrows its query by the caller's `SearchScope` in LINQ before any text matching, so the same code runs in production and in tests:
  - people: every profile (profiles are visible to every signed-in member);
  - partners: only for a lead role (City, Event, Create, Communications Lead), Staff or System Admin, as on the partner board (ADR 0014);
  - contacts: only the caller's own active contacts, System Admin included, as the contacts list does (ADR 0003, ADR 0014);
  - work items: active items in active workspaces the caller owns or belongs to; Staff and System Admin see every workspace (ADR 0011).
- **Text matching behind `IFullTextSearch`.** `PostgresFullTextSearch` (Infrastructure) matches a stored, generated `SearchVector` column (`to_tsvector('simple', …)`) against a prefix query built from the term's words (`grace:* & tor:*`), so partial names match and every word must match; the `simple` configuration avoids stemming names. Each column has a GIN index, and results are ordered by `ts_rank`. Documents: profile name, home city and bio; contact name, email, organisation and city; partner name, offering, contact name and notes; work item title and description. Contact notes live in their own table and are not searched globally.
- **Terms.** The term is trimmed; under 2 characters the API answers `400` and the page shows a hint without calling it. Each group returns at most 10 results.
- **Tests.** The search columns are mapped only on Npgsql. API tests register an in-memory `IFullTextSearch` with the same documents, so the permission rules run against real handlers and the EF in-memory database; the tsquery builder is unit-tested.
- **Performance.** Verified outside the test suite: seed 100,000 profiles in a local database (SQL in the design) and run `eng/load-test.js` with `SCENARIO=search`, whose threshold is p95 under 500 ms.

## Consequences

- The events group appears once events are stored and register a source; the search page already renders every group.
- A new searchable table needs its `SearchVector` column and GIN index in `SearchVectors`, a document in the test matcher, and a source that applies its permission rule before matching.
- The Postgres SQL itself is exercised only against a real database, outside the test suite.
