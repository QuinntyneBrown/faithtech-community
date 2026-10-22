# Dynamics 365 adopted features: shared decisions

Working brief for the partner activity timeline, duplicate detection and merge, event check-in and Reports (proposal `docs/proposals/sharepoint-dynamics-features.md`). Every phase (mocks, design system, specs, designs, ADRs, estimates, code) follows these decisions. Where a phase finds one unworkable it records why in the detailed design's open questions and the matching ADR.

Date: 2026-10-22. Branch: `feature/dynamics-adopted-features` (from `main`, after PR #392).

## Requirement IDs

L1-022 Reports (RPT) is new. L1-005, L1-006 and L1-008 gain one-line trace notes only.

| ID | Title | Feature |
| --- | --- | --- |
| L2-085 | Log a partner activity | partners / partner-activity-timeline |
| L2-086 | Partner activity timeline | partners / partner-activity-timeline |
| L2-087 | Partner activity access and audit | partners / partner-activity-timeline |
| L2-088 | Possible duplicate partner | partners / duplicate-detection-and-merge |
| L2-089 | Merge partners | partners / duplicate-detection-and-merge |
| L2-090 | Merge access, audit and restore | partners / duplicate-detection-and-merge |
| L2-091 | Possible duplicate contact | contacts / possible-duplicate-contact |
| L2-092 | Check-in access | events / event-check-in |
| L2-093 | Check-in list and search | events / event-check-in |
| L2-094 | Check in and undo | events / event-check-in |
| L2-095 | Add a walk-in | events / event-check-in |
| L2-096 | Attendance on the event page and check-in states | events / event-check-in |
| L2-097 | Export attendance | events / event-check-in |
| L2-098 | Reports access | reports / reports-dashboard |
| L2-099 | Report filters | reports / reports-dashboard |
| L2-100 | Report figures | reports / reports-dashboard |
| L2-101 | Report charts and tables | reports / reports-dashboard |
| L2-102 | Report states | reports / reports-dashboard |
| L2-103 | Export a report | reports / reports-dashboard |
| L2-104 | Report performance | reports / reports-dashboard |

Cross-references (do not copy): L2-017 and L2-018 (partner records and Kanban), L2-012, L2-013 and L2-014 (contact privacy, create/edit, notes), L2-015 (contact signs up), L2-020 to L2-024 (events, list, RSVP, public events and guest RSVP, calendar), L2-054 (toasts), L1-003 (Staff read-only) and L1-014 (audit log).

## ADRs

- 0023 Partner duplicate match rule
- 0024 Partner merge semantics and restore
- 0025 Check-in storage on the RSVP
- 0026 Report metric definitions
- 0027 Reports feature added to the layout

## Partner activity timeline (L2-085 to L2-087)

- New entity `PartnerActivity` in `Domain/Partners/`: `Id`, `PartnerId`, `Kind` (`Call`, `Email`, `Meeting`, `Note` logged by people; `Added`, `StageMoved`, `Merged` written by the system), `Summary` (required for logged kinds, 1 to 2000 characters after trimming), `OccurredOn` (date, required, not in the future), `OccurredAt` (optional time of day), `NextStep` (optional, up to 200 characters), `NextStepDue` (optional date; only with a next step), `LoggedById`, `LoggedAtUtc`, `MergedFromPartnerId` (set when a merge moved it).
- The system writes `Added` when a partner is created ("Added {name} as a lead") and `StageMoved` on every stage move, carrying from, to and the move note. Existing `PartnerStageChange` rows stay as the stage record; the migration backfills a `StageMoved` activity for each existing stage change.
- Timeline: one shared list on the partner page, every lead sees it, ordered newest first by `OccurredOn`, then `OccurredAt` (missing time sorts as start of day), then `LoggedAtUtc`. Type chips filter by All, Calls, Emails, Meetings, Notes, Stage moves (Stage moves includes Added and Merged). Paged 50 at a time with "Show older". The timeline replaces the History list. Empty state: `partner/activity-empty`.
- Next step: the latest logged activity (by the timeline order) that has a next step. It shows in the partner's Details and on the Kanban card. "Last activity" on the partner header is the latest timeline entry's date.
- Access: lead roles (City, Event, Create, Communications Lead) and System Admin log activities; Staff read the timeline but every Staff write is refused (403); members without a lead role and Staff-only callers cannot write; anonymous is 401. A System Admin without a lead role writing is audited (`partner.activity.logged`). Logged activities cannot be edited or deleted in v1 (deferred).
- Endpoints: `GET /api/partners/{id}/activities?kind=&before=` and `POST /api/partners/{id}/activities`.

## Partner duplicates and merge (L2-088 to L2-090)

- Match rule (ADR 0023): two non-archived partners are possible duplicates when their normalised website hosts are equal (lowercase, drop scheme, a leading `www.`, port, path, query and trailing dot), or their normalised names are equal (lowercase, accents folded, punctuation removed, whitespace collapsed, one trailing company suffix removed: inc, incorporated, ltd, limited, llc, corp, corporation, co, company). Email domain is not used: shared mail providers would flag unrelated partners. The mock copy is changed to match.
- The partner page shows a warning alert (`role="status"`, with its icon) for the first undismissed match, naming who added it and when when the Added entry exists. Actions: Compare and merge, Open {other}, Not the same. "and N more" when several match.
- Not the same: stored once per unordered pair (`PartnerDuplicateDismissal`: lower id, higher id, by, at) and hides the alert for that pair for every lead. Lead roles and System Admin may dismiss; Staff cannot.
- Merge (ADR 0024): `POST /api/partners/{keepId}/merge` with `otherId`, the version of each record the lead saw, and a choice per differing field (name, stage, contact name, email, phone, website, offering, owner): `keep` or `other`. Notes are not chosen: when both have notes they are joined, the kept record's first. Both timelines and stage history move into the kept record (each moved row records `MergedFromPartnerId`), a system `Merged` activity is written on the kept record ("Merged {other} into {kept}"), and the other record is archived with `MergedIntoId`. Archived partners leave the board, search, duplicate checks and Reports.
- Conflict: each partner carries a `Version` that every edit, stage move, merge and restore increments. A merge whose versions no longer match returns 409 and the dialog shows the failed state with "reload and try again".
- Access: lead roles and System Admin may merge; Staff and others 403. Every merge writes an audit entry (`partners.merged`) whoever does it. Restore is System Admin only: `POST /api/partners/{id}/restore` un-archives the record, moves back every row with `MergedFromPartnerId` equal to it, writes a system entry on both records and an audit entry (`partner.restored`). The archived partner's page (`partner/archived` mock) shows who merged it, into which record, and Restore for System Admin.

## Contact duplicate (L2-091)

- The new and edit contact form checks the email when the field loses focus (and before save): `GET /api/contacts/duplicates?email=&excludeId=` searches only the signed-in caller's own contacts, active or archived, by case-insensitive trimmed email. System Admin is checked against their own contacts too: the check never reveals another lead's contact. It returns the first match's id, name, organisation, added date and note count, or 204.
- The warning alert (`role="status"`) offers Open {name}; saving a separate contact stays possible ("Save as a new contact"). A test proves another lead's contact with the same email never triggers it.

## Event check-in (L2-092 to L2-097)

- Storage (ADR 0025): on `Rsvp`, add `CheckedInAt` (time stamp), `CheckedInById` and `IsWalkIn`. A walk-in is an RSVP row created at the door: it skips the capacity and has-started rules, `GuestEmail` becomes optional for walk-ins, and when the email matches a verified member's account the row links to that profile (`ProfileId`) instead. "Check them in now" defaults on. An RSVP that already exists for that member or email is reused rather than duplicated.
- Access: lead roles (City, Event, Create, Communications Lead) and System Admin open the page and write; Staff open it read-only (switches disabled, no Add walk-in, no guest emails, matching L2-022 AC4); members without those roles get 403 and the forbidden page; anonymous visitors 401 and sign-in. A System Admin without a lead role is audited for each write.
- Check in and undo: `PUT /api/events/{id}/check-ins/{rsvpId}` and `DELETE` the same. Each saves at once; the row shows "Checked in 6:41 pm"; a success toast offers Undo; a failed save reverts the switch and shows a danger toast. Rows stay in RSVP order (walk-ins at the end); search narrows by name or email as the lead types.
- Cancelled events cannot be checked in (409; the page shows the event is cancelled and the switches are disabled). An event can be checked in from 24 hours before it starts; earlier writes return 409 ("Check-in opens on {date}"). (Simplest rule that still lets leads prepare.) "Everyone's here" shows when every attendee is checked in; it no longer promises a recap email (deferred).
- Event page: leads, Staff and System Admin see "{n} checked in" beside the RSVP count once any check-in exists; the event list and public page are unchanged.
- Export: `GET /api/events/{id}/check-ins.csv` for lead roles and System Admin (not Staff, because it carries guest emails): name, type (Member, Guest, Walk-in), email, RSVP'd at, checked in at.
- Endpoints: `GET /api/events/{id}/check-in` (event summary, counts, attendees, `canEdit`), `PUT`/`DELETE /api/events/{id}/check-ins/{rsvpId}`, `POST /api/events/{id}/walk-ins`, `GET /api/events/{id}/check-ins.csv`.

## Reports (L2-098 to L2-104)

- Access: Staff and System Admin only; every other caller gets 403 from the server and the forbidden page. City Leads are refused. Shell navigation shows Reports for Staff and System Admin only (ADR 0009 updated).
- Filters: city (All cities, or one of the cities that verified members or events use, sorted) and period (Last 30 days, Last 90 days, This year, All time). Apply reloads; the URL carries `?city=&period=`. Default All cities, Last 30 days.
- Definitions (ADR 0026), all computed on the server:
  - Members: profiles whose account has a verified email and is not suspended; the city filter uses the profile's home city. Context: "+N in the {period}" counts those whose new `Profile.JoinedAtUtc` falls in the period (set at sign-up; existing profiles have none and are not counted as new).
  - Events held: not cancelled and started within the period, up to now; context "{n} cancelled" counts cancelled events that were due to start within the period. The city filter uses the event's city.
  - RSVPs: RSVPs on events held in the period, walk-ins excluded; context "{p}% checked in" is RSVPs checked in divided by RSVPs on those events (walk-ins excluded from both), shown only when some RSVP exists.
  - Partners confirmed: non-archived partners at Confirmed, context "of {n} in the pipeline". A partner's city is its owner's home city; partners with no owner or an owner with no city count under "No city" and only under All cities. The pipeline is a snapshot, so the period does not apply.
  - Announcements: sent within the period; the city filter uses the author's home city. Context "sent by leads".
  - Private contacts and their notes are never read by any report query.
- Charts: Members by city (the top four cities by members, the rest and "No city" as Other; under one city it shows that city alone) and New members by month (each calendar month in the period, at most the last 12, the current month marked "so far"). Bars are `.progress-chart` rows: tracks are `aria-hidden`, the row text carries the value.
- Tables: Partner pipeline by city (Lead, In funnel, Confirmed per city) and Events and attendance (events starting in the period and the next 30 days, newest first, at most 50: event, date, city, going, checked in with rate, or Upcoming / Cancelled).
- States: loading (skeletons), empty (no members or events for the filters: "Nothing to report for {city} in the {period}"), error (retry), forbidden.
- Export: `GET /api/reports/export.csv?city=&period=` returns the figures, both charts and both tables shown, one section after another, for the same filters. CSV writing lives in Infrastructure behind `ICsvWriter` (RFC 4180 quoting and a formula-injection guard on cells starting with `=`, `+`, `-`, `@`).
- Endpoint: `GET /api/reports?city=&period=` returns the whole report in one DTO.
- Performance: each report request answers within 1 second at the 95th percentile with 10,000 members, 1,000 events and 50,000 RSVPs; every figure is a server-side aggregate (`GroupBy`/`Count`), no per-row queries, using indexes on `Profile.HomeCity`, `Event.StartsAt` and `Rsvp.EventId`. Queries are plain LINQ so they run on the in-memory provider in tests.

## Code placement

- Backend: `Application/Partners/` (LogPartnerActivity, PartnerTimeline, PartnerDuplicates, MergePartners, RestorePartner), `Application/Contacts/` (FindDuplicateContact), `Application/Events/` (CheckIn, WalkIns, ExportCheckIns), `Application/Reports/` (GetReport, ExportReport, ReportAccess), `Application/Common/ICsvWriter.cs`, `Infrastructure/Csv/CsvWriter.cs`, migrations in `Infrastructure/Persistence/Migrations/`. `Domain/Reports/` is not needed.
- Frontend: `api` gains contracts and tokens (`PARTNER_ACTIVITY` additions on the partners service, `CHECK_IN_SERVICE`, `REPORTS_SERVICE`, contact duplicate check on the contacts service). `components` gains `ft-progress-chart` (bar chart) and a list row with a trailing switch, plus whatever filter-bar or stat context line is missing. `partners` gains the Log activity and Merge partners dialogs and the timeline on the partner page; `contacts` the warning on the contact form; `events` the check-in page (`/events/:id/check-in`) and the Add walk-in dialog; the new `reports` library (`/reports`) is lazy-loaded from the shell.
- E2E: fake additions in `e2e/fixtures/mock-partners.ts`, `mock-contacts.ts`, `mock-events.ts` and a new `mock-reports.ts`; page objects in `e2e/pages/`; specs in `e2e/tests/{partners,contacts,events,reports}/`.

## Deferred

Post-event recap email; configurable dashboards; fuzzy duplicates across leads' contacts; editing or deleting a logged activity; every "Later" and "No" proposal row; SharePoint items; hackathon teams, projects and judging (v2).
