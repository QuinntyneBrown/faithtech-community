# 0017. Global search sources, scope and full-text query

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-026
- Designs: `docs/detailed-designs/search/global-search`

## Context

L2-026 groups results into people, events, partners, contacts and work items, filtered by what the caller may open, using Postgres full-text search, with p95 under 500 ms at 100,000 records. Only profiles are stored today; events, partners, contacts and work items arrive with their features. Backend tests must not need Postgres. The design left the per-group limit open.

## Decision

- **One source per kind.** `ISearchSource` (Application, `Search/`) has a `Kind` and `SearchAsync(term, scope, limit)`. `GlobalSearchHandler` asks only the sources whose kind the caller's `SearchScope` allows, in the order people, events, partners, contacts, work items, and leaves out empty groups. A later feature adds its kind by registering one more source.
- **Scope from roles.** `SearchScope.For(roles, callerProfileId)`: people and events for every member; partners only for leads (City, Event, Create, Communications), Staff and System Admin; contacts restricted to the caller's own (System Admin all, Staff none beyond their own); work items for Staff and System Admin, and otherwise only in workspaces the caller belongs to. Sources apply the owner and membership filters inside their query.
- **Terms.** The term is trimmed; under 2 characters the API answers `400` and the page shows a hint without calling it.
- **Postgres.** `PostgresPeopleSearch` (Infrastructure) matches `to_tsvector('simple', name ‖ home city ‖ bio)` against a prefix query built from the term's words (`grace:* & tor:*`), so partial names match; the `simple` configuration avoids stemming names. A GIN expression index on that vector serves it, and results are ordered by `ts_rank`, then name. Each group returns at most 10 results.
- **Tests.** API tests replace the Postgres source with an in-memory source over the same profiles; the tsquery builder is unit-tested. Permission rules are proven against fake partner, contact and work-item sources that record the scope they were asked with.
- **Performance.** Verified outside the test suite: seed 100,000 profiles in a local database (SQL in the design) and run the `search` scenario of `eng/load-test.js`, whose threshold is p95 under 500 ms.

## Consequences

- Only the people group returns results until the other features register sources; the search page already renders every group.
- Each new source must create its own GIN index and apply its scope filters in SQL.
