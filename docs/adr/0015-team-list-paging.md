# 0015. Team list paging

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-019, L2-046
- Designs: `docs/detailed-designs/team/team-list`, `docs/detailed-designs/platform/performance`
- Supersedes: the "no paging" point of ADR 0007

## Context

ADR 0007 left the team list unpaged, because a team is a few dozen people per city. L2-046 AC3 requires every list endpoint to be paged, with at most 100 a page. The team is global, so every city's leads and volunteers come back in one response, and `ListTeamHandler` loaded every team profile into memory before filtering. The city select must still offer every team member's city, and every matching member must stay reachable.

## Decision

- `GET /api/team?role=&city=&after=&pageSize=` returns `{ members, cities, next, totalCount }`. Pages hold 50 members by default and at most 100.
- The role and city filters and the name order run in the database before paging. Members are ordered by lower-cased name, then by profile id, so members who share a name keep a stable order.
- `next` is a keyset continuation: the last member's lower-cased name and id, encoded opaquely. Members who gain or lose a team role between requests never make a later page repeat or skip anyone. A continuation the list did not give out answers `400`.
- `totalCount` counts the members that match the filters. `cities` still lists every team member's home city, whatever the filters and the page, as ADR 0007 decided.
- Membership is still derived from current roles on every request. A member whose team role is removed is gone from the next request.
- The team page shows "Showing N of M members" and *Show more members*, the same pattern as the invites page. A failed continuation keeps the members already shown and offers to try again.

Everything else in ADR 0007 stands.

## Consequences

- No response carries more than 100 members, and the API reads only one page of profiles per request, plus the distinct home cities.
- In PostgreSQL the name order and the keyset comparison both use the column's collation, so they agree. The id tie-break is a `uuid` comparison.
