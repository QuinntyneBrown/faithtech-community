# Global search

## Overview

The Community platform holds each organisation's people, events, partners, private contacts, Agile work items, resources and notes. Global search lets a signed-in member find any of them from one search box, with results grouped by kind.

Key terms:

- **full-text search** — PostgreSQL text search using `tsvector` documents and `tsquery` queries, ranked by relevance
- **search document** — `tsvector` value built from the searchable fields of one record
- **result group** — set of results of one kind: people, events, partners, contacts or work items

Search never widens what a user may open. Every base query is scoped to the current organisation by the DbContext's global filter on `ICurrentOrganisation` (`L2-130` AC2), and the server filters every group by permission before results leave the API: a caller sees only the private contacts they own (`KeepContacts`), partners only when the caller holds `ViewPartners`, work items only for workspace members and holders of `ReadAllWorkspaces`, and resources and notes only those `L2-060` and `L2-092` let them open; a holder of `AdministerOrganisation` holds every capability (`L2-135` AC3).

## Description

- **`SearchPage`** — routed page in the `search` feature library (mock: `docs/mocks/pages/search/`, states `default`, `member`, `loading`, `empty`, `invalid`, `no-results`, `error`). The term lives in the address (`/search?q=`), so the top bar's search box and the page's own `<form role="search">` both land here. It shows the minimum-length hint, grouped results through `SearchResultsComponent` from `components`, and an empty state that suggests other terms.
- **`SearchService` / `SEARCH_SERVICE`** — API client contract and token in the `api` library; `HttpSearchService.search(term)` calls the API, and resolves a term under 2 characters to no groups without calling it.
- **`SearchEndpoints`** — maps `GET /api/search?q=` with authentication required.
- **`GlobalSearchHandler`** — Application handler that trims the term, answers `400` for fewer than 2 characters (so no search runs, `L2-026`) or more than 200, and asks one `ISearchSource` per result kind for the caller's matches, returning the non-empty groups in a fixed order: people, events, partners, contacts, work items. Each group holds at most 10 results, best match first.
- **`ISearchSource`** — Application contract for one searchable kind. Each source (`PeopleSearchSource`, `EventsSearchSource`, `PartnersSearchSource`, `ContactsSearchSource`, `WorkItemsSearchSource`) starts from the organisation-scoped query already filtered by what the caller may open, using the feature's own access rules (`PartnerAccess` over `ICurrentUser.Has(Capability.ViewPartners)`, `WorkspaceAccessPolicy` over `ReadAllWorkspaces`, the caller's profile id for contacts), then asks `IFullTextSearch` to match the term. A later feature plugs in a new kind by registering a source.
- **`IFullTextSearch`** — Application contract that filters and ranks a query by a term. **`PostgresFullTextSearch`** in Infrastructure matches a generated, GIN-indexed `tsvector` column (`SearchVector`) on each searchable table with a prefix query of the term's words (`to_tsquery('english', 'gra:* & she:*')`) and orders by `ts_rank`, so the permission filter and the text match run in one SQL statement. Backend tests use an in-memory implementation that matches the same fields case-insensitively (ADR 0016).
- **`SearchResultsDto`** — grouped results, each item carrying id, title, snippet, route and, where it applies, the event's start and a badge ("Private", a partner's stage, "Public" or "Cancelled").

- **`NotesSearchSource`** — Docs & notes adds the kind `Note` after `Resource`, shown as the **Notes** group: pages from `NoteAccess.Visible` (never archived) matched on title and body text, at most 10, routed to `/notes/{id}` with a "Private", "Shared" or "Shared with you" badge (`L2-096`, `notes/archive-and-search`).

The p95 target is under 500 ms with 100,000 indexed records; it needs PostgreSQL, so it is checked with `eng/load-test.js` in the isolated performance environment after `seed-search-records 100000` rather than in the backend tests (ADR 0016). Contact notes are not searched yet.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-026` | `L1-009` | Global search |
| `L2-130` | `L1-025`, `L1-015` | Organisation record and isolation |

### Acceptance criteria

**`L2-026` — Global search**

1. Given a signed-in member, when they search, then results are grouped into people, events, partners, contacts, work items and resources, using Postgres full-text search, and include only the current organisation's records (`L2-130` AC2).
2. Given any user, when results are built, then they include only items that user is permitted to open: their own contacts only (`KeepContacts`), partners only for holders of `ViewPartners`, work items only for workspace members and holders of `ReadAllWorkspaces`, and resources only those the user may open under `L2-060`, never archived ones; a holder of `AdministerOrganisation` holds every capability (`L2-135` AC3).
3. Given no matches, when the search completes, then an empty state suggests other terms.
4. Given a search term shorter than 2 characters, when it is submitted, then no search runs and a hint is shown.
5. Given 100,000 indexed records, when a member searches, then results return in under 500 ms at p95.

**`L2-130` — Organisation record and isolation**

1. Given any scoped record, when it is created, then it is stamped with the current organisation, and no request can set a different one.
2. Given a list, search, export, notification, SignalR group or report, when it is built, then the organisation filter is applied in the database query through the context's global filter, not after loading the data (`L2-042` AC3).
3. Given a record id that belongs to another organisation, when it is requested by id, by link, by `.ics`, by public event page, by connect link, by invite token or by share, then the response is 404 or the "unknown" outcome the feature already uses, never the record (`L2-042` AC2).
4. Given a unique rule in any feature (one connect link per owner, one pending connection, unique chapter name, unique role name), when it is enforced, then it is unique within the organisation only, so two organisations may each hold the same value.
5. Given an uploaded file (photo, contact photo, resource, note image), when it is stored, then its blob path starts with the organisation's id, and it is served only on that organisation's host.
6. Given an email the system sends, when it is composed, then its sender display name, subject prefix, footer and links use the organisation's name and host, and the unsubscribe link (`L2-028`) works on that host.
7. Given the audit log, when any entry is written, then it belongs to the organisation and is listed only on that organisation's audit page (`L2-041`).

## Diagrams

### System context

Members search the Community platform from one box. What each sees depends on that person's capabilities.

![C4 system context for global search](diagrams/c4-context.png)

### Containers

The `SearchPage` calls the Community API, which runs PostgreSQL full-text search in the Community database.

![C4 container view for global search](diagrams/c4-container.png)

### Components

Each `ISearchSource` filters by the caller's permissions, and `PostgresFullTextSearch` adds the text match to the same SQL, so unpermitted rows never leave the database.

![C4 component view for global search](diagrams/c4-component.png)

### Class structure

Each `ISearchSource` derives visibility from `ICurrentUser` over a query scoped by `ICurrentOrganisation`; `PostgresFullTextSearch` realizes `IFullTextSearch`; the handler returns `SearchResultsDto` grouped by `SearchResultKind`.

![Class diagram for global search](diagrams/class-structure.png)

### Behaviour — search across the community

Terms under 2 characters stop at the page or the handler with a hint. Valid terms run full-text search filtered by each source's permissions, and the page groups results or shows an empty state (`L2-026`).

![Sequence diagram: search across the community](diagrams/sequence-search.png)
