# 0031. Reports feature added to the layout

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-024, L2-123 to L2-129, L2-045 AC4 and AC5
- Design: `docs/detailed-designs/reports/reports-dashboard`
- Refines: ADR 0009, ADR 0010

## Context

Reports (L1-024) is a new subsystem. The mandatory repository layout in `AGENTS.md` had no place for it: no `Reports/` folder in `FaithTech.Community.Application`, no `reports` feature library, no `e2e/tests/reports/`, and nowhere for CSV writing in Infrastructure. The layout may change only with the user's approval, recorded in `AGENTS.md` before code is placed. The brief (`docs/prompts/dynamics-adopted-features-decisions.md`) gave that approval and placed the code.

## Decision

- The subsystem is named `reports` everywhere: `Application/Reports/` (`ReportAccess`, `ReportPeriod`, `GetReport`, `ExportReport`, `ReportDto`), `frontend/projects/reports/` (`@faithtech-community/reports`), `docs/detailed-designs/reports/`, `docs/estimates/reports.md`, `e2e/tests/reports/`, `e2e/fixtures/mock-reports.ts` and `backend/tests/FaithTech.Community.Api.Tests/Reports/`.
- There is **no `Domain/Reports/`**. A report owns no data; it reads Profiles, Events, Partners and Announcements. The one Domain change is `Profile.JoinedAtUtc` in `Domain/Profiles/`.
- `ICsvWriter` and the `CsvFile` record live in `Application/Common/`, because Reports and event check-in both export CSV; `CsvFile` moves there from `Application/Events/`. The implementation is `Infrastructure/Csv/CsvWriter.cs`.
- The `reports` library follows every feature-library rule: it depends only on `components` and `api`, exposes `REPORTS_ROUTES` through `public-api.ts`, and is lazy-loaded by the app shell at `/reports` inside the auth guard. `api` gains `ReportsService`, `REPORTS_SERVICE` and `HttpReportsService`.
- The UI the report needs that `components` lacks is added there first: `ft-progress-chart`, a `context` line on `ft-stat`, `ft-filter-bar`, a row-header column on `ft-table` and a `reports` icon.
- In the shell (ADR 0009), Reports is a secondary section for Staff and System Admin, between People and Admin.

## Consequences

- `angular.json`, `tsconfig.json` paths and the `build:libs` and `test` scripts each gain a `reports` entry.
- A future reporting need (more figures, other audiences) extends this subsystem rather than adding report code to the features it reads.
- The audit log and RSVP exports still write CSV with their own helpers; moving them to `ICsvWriter` is a separate change.
