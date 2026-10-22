# 0026. Report metric definitions

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-022, L2-098 to L2-104
- Design: `docs/detailed-designs/reports/reports-dashboard`
- Refines: ADR 0014, ADR 0024, ADR 0025

## Context

Reports (L1-022) gives Staff and System Admins city-level numbers. A number that two people read differently is worse than no number, and the page, the CSV export and the e2e fake must agree. The brief (`docs/prompts/dynamics-adopted-features-decisions.md`) fixed the figures; this record fixes the edges it left open: what a member and a new member are, which time zone and window edges apply, how a partner gets a city, how walk-ins count, and how the queries stay fast and testable.

## Decision

### Windows

- Periods are `last-30-days` (the default), `last-90-days`, `this-year` and `all-time`. `To` is now (`TimeProvider`); `From` is now minus 30 or 90 days, 1 January of the current UTC year, or none for All time. A time counts when `From <= t <= To`. Months and years are UTC calendar months and years.

### Figures

- **Members** — profiles whose account has a verified email (`CommunityUser.EmailConfirmed`) and is not suspended (`Profile.IsSuspended`); one city means the profile's `HomeCity` equals it.
- **New members ("+N in the {period}")** — Members whose `Profile.JoinedAtUtc` is in the window. `JoinedAtUtc` is new, nullable, set once when the account is created (email sign-up, connect sign-up, Google, invite acceptance) and never changed. It is not backfilled, because Identity stores no creation time, so older profiles are never new. The context is hidden for All time, where every member would be new.
- **Events held** — events not cancelled whose `StartsAt` is in the window; one city means `Event.City`. Context "{n} cancelled": cancelled events whose `StartsAt` is in the window.
- **RSVPs** — RSVPs on the events held, walk-ins excluded. Context "{p}% checked in": those with `CheckedInAt` set divided by RSVPs, rounded half away from zero, shown only when RSVPs is above 0. Walk-ins are excluded from both so the rate never passes 100% (ADR 0025).
- **Partners confirmed** — non-archived partners (ADR 0024) at Confirmed; context "of {n} in the pipeline", every non-archived partner. A partner's city is its owner's `HomeCity`, whatever the owner's account state; no owner or no home city is "No city", counted only under All cities. The pipeline is a snapshot; the period does not apply.
- **Announcements** — announcements whose `SentAt` is in the window; one city means the sender's `HomeCity`. Context "sent by leads".
- **Private contacts** — contacts, their notes, photos and pending connections are never read by any report query or export (L2-100 AC6, ADR 0014).

### Charts and tables

- **Members by city** — under All cities, the four cities with most Members (ties by name) and "Other" for every other city plus blank home cities, shown when above 0; under one city, that city alone. Bars are scaled to the largest value.
- **New members by month** — every UTC calendar month the window touches (for All time, from the first join time), the last 12 at most, empty months as 0, the current month marked "so far".
- **Partner pipeline by city** — Lead, In funnel and Confirmed per partner city, alphabetical, "No city" last.
- **Events and attendance** — events starting from `From` to 30 days after now, newest first, at most 50. Cancelled shows "Cancelled"; a future start shows "Upcoming" with its going count; otherwise going and checked in (walk-ins excluded) with the rate.
- **Empty** — Members is 0 and the Events and attendance list is empty.
- **City list** — the distinct non-blank home cities of Members plus the cities of all events, ordinal-ignore-case sorted; matched exactly. An unknown city or period is `400`.

### Computation

- Every number is computed on the server by `GetReportHandler` as `CountAsync` or `GroupBy`/`Count` projections over `IApplicationDbContext`, with correlated counts for the events table; no query runs per row and no entity is loaded to be counted. Shaping (top four, empty months, percentages) runs in memory over at most one row per city, stage or month.
- Queries are plain LINQ that both Npgsql and the EF Core in-memory provider translate, so backend integration tests run without PostgreSQL. Left joins guard the missing side (`o == null ? null : o.HomeCity`).
- Indexes: new `IX_Profiles_HomeCity`; existing `IX_Events_StartsAt`, the unique `ProfileId` index on the users table, `IX_Rsvps_EventId_GuestEmail` (leading `EventId`, so no separate `Rsvp.EventId` index), `IX_Announcements_SentAt` and `IX_Partners_Stage`. The 1-second p95 budget at 10,000 members, 1,000 events and 50,000 RSVPs is checked by the load test against PostgreSQL.

### Export

- CSV is written by `ICsvWriter` (`Application/Common`, implemented in `Infrastructure/Csv/CsvWriter.cs`) as `string Write(IEnumerable<IReadOnlyList<string?>> rows)`: RFC 4180, every cell quoted, quotes doubled, CRLF line ends, null as an empty cell, and a `'` prefix on cells starting with `=`, `+`, `-`, `@`, tab or carriage return. The event check-in export uses the same writer. The members context in the CSV reads "18 new in the {period}" so the guard never alters it.

## Consequences

- One definition serves the page, the CSV and the e2e fake (`e2e/fixtures/mock-reports.ts`), which recomputes from its own data so privacy and exclusions are asserted end to end.
- "New members" undercounts until profiles created after the migration accumulate; the month chart starts thin.
- Free-text home cities split on spelling ("Toronto" and "toronto"); normalising cities is deferred.
- UTC months can put a late-evening event or join in the next month for western cities; a city time zone is deferred.
- A metric change is a change to this record, the handler, the fake and the tests together.
