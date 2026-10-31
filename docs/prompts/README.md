# Prompts: organisations

These prompts implement the organisations subsystem (`docs/proposals/organisations.md`, `L1-025` to `L1-029`,
`L2-130` to `L2-152`, ADRs 0032 to 0035, `docs/detailed-designs/organisations/`). They make the platform
organisation-agnostic. Each prompt is one slice, and you run them in number order. Each one starts from `main`, works on
its own branch and ends with a pull request. Merge a slice before you start the next.

## How the plan is sliced

- **Design artefacts come first.** Prompt `00` writes the mocks, design-system pages, screen composition and estimate
  that `AGENTS.md` requires before any implementation. It writes no production code.
- **Tenancy before permissions.** Slices `01` to `09` make the host pick the organisation, scope every record, file,
  message and email, and make the profile the membership. Slices `10` to `14` turn roles into data and switch every
  rule to capabilities. Settings, chapters and taxonomies come after that, then platform operators.
- **FaithTech is unchanged after every slice.** The FaithTech seed is the regression case. Every existing backend test
  and Playwright spec has to pass at the end of each slice, unless that slice's requirements rewrite the behaviour.
- **Big swaps are split so the code always builds.** Slice `10` moves roles into data but keeps a temporary adapter,
  so the access classes still work. Slice `11` switches the server to capabilities and removes the adapter. Slice
  `12` switches the frontend and the e2e fake.
- **One migration per slice that changes the schema.** The seed-faithtech design names a single migration. The plan
  spreads it over several migrations instead, and slice `01` records that in the design.
- **Vertical slices.** Each slice ships the Domain, Application, Api, frontend and e2e fake for its acceptance criteria.
  Each one is built with ATDD through the `implementing-incrementally` skill.

## Order

| # | Prompt | Slice | Requirements | Status |
|---|---|---|---|---|
| 00 | [00-mocks-design-system-and-estimate.md](00-mocks-design-system-and-estimate.md) | Mocks, design system, screen composition, estimate | `L2-147` AC4 and every screen the subsystem changes | Done |
| 01 | [01-organisation-record-and-host-resolution.md](01-organisation-record-and-host-resolution.md) | Organisation record, host resolution, unknown-host and suspended pages | `L2-131` AC1 to AC5, `L2-151` AC1 (row) | Done |
| 02 | [02-scope-every-record.md](02-scope-every-record.md) | `OrganisationId`, global filter, stamping, per-organisation unique indexes | `L2-130` AC1 to AC4, AC7 | Done |
| 03 | [03-scope-files-search-and-live-updates.md](03-scope-files-search-and-live-updates.md) | Blob prefixes, search, SignalR groups | `L2-130` AC2, AC5 | Done |
| 04 | [04-organisation-name-in-copy-titles-and-email.md](04-organisation-name-in-copy-titles-and-email.md) | `/api/site`, short name in shell and titles, email, `.ics` | `L2-134` AC1, AC2, AC4, AC5, `L2-130` AC6 | Done |
| 05 | [05-marketing-cors-and-static-sites-per-host.md](05-marketing-cors-and-static-sites-per-host.md) | Marketing per public host, static sites by host kind, CORS | `L2-134` AC3, `L2-131` AC6 | Done |
| 06 | [06-profile-per-organisation-and-not-a-member.md](06-profile-per-organisation-and-not-a-member.md) | `Profile.UserId`, current membership, not-a-member page | `L2-132` AC3, AC4 | Done |
| 07 | [07-joining-an-organisation.md](07-joining-an-organisation.md) | Sign-up, invite, connect link and Google create memberships | `L2-132` AC1, AC2, AC7 | Done |
| 08 | [08-membership-suspension.md](08-membership-suspension.md) | Suspension per membership, revocation per organisation | `L2-132` AC5, `L2-039` | Done |
| 09 | [09-me-endpoint-and-organisation-switcher.md](09-me-endpoint-and-organisation-switcher.md) | `/api/me` memberships, Switch organisation | `L2-133` AC1, AC3, AC4 | Done |
| 10 | [10-capability-catalogue-and-role-definitions.md](10-capability-catalogue-and-role-definitions.md) | Capability catalogue, role definitions, FaithTech definitions, computed capabilities | `L2-135` AC1, AC2, `L2-151` AC2 | Done |
| 11 | [11-authorise-by-capability.md](11-authorise-by-capability.md) | Every access class by capability, override audit, `Role` removed | `L2-135` AC3 to AC6, `L2-151` AC5 | Done |
| 12 | [12-frontend-and-fake-by-capability.md](12-frontend-and-fake-by-capability.md) | Navigation and features by capability, fake computes capabilities | `L2-135` AC7, `L2-133` AC2, AC5 | To do |
| 13 | [13-last-administrator-and-capability-loss.md](13-last-administrator-and-capability-loss.md) | Organisation admin roster, last-administrator guard, `CapabilityLost` | `L2-139` | To do |
| 14 | [14-assign-roles-under-grant-rules.md](14-assign-roles-under-grant-rules.md) | `RoleGrantPolicy`, role routes by id, `grantableRoleIds`, `GET /api/organisation` | `L2-137` AC4, AC5, `L2-138` | To do |
| 15 | [15-organisation-section-and-general-settings.md](15-organisation-section-and-general-settings.md) | `organisations` library, Organisation section, General | `L2-147` AC1 to AC5 | To do |
| 16 | [16-roles-page-define-and-edit.md](16-roles-page-define-and-edit.md) | Roles tab: list, define, edit | `L2-136` AC1 to AC3, AC5 to AC8 | To do |
| 17 | [17-archive-roles-and-grant-rules.md](17-archive-roles-and-grant-rules.md) | Archive roles, Who may grant | `L2-136` AC4, AC5, `L2-137` AC1 to AC3 | To do |
| 18 | [18-chapter-label-and-chapters-page.md](18-chapter-label-and-chapters-page.md) | Chapter label on General, Chapters tab | `L2-140` | To do |
| 19 | [19-chapters-on-profiles-and-events.md](19-chapters-on-profiles-and-events.md) | Home chapter, event chapter, migration from city text | `L2-141` AC1, AC2, AC4 to AC6 | To do |
| 20 | [20-chapter-filters-and-picker-suffixes.md](20-chapter-filters-and-picker-suffixes.md) | Team, events, People and Reports chapter filters, picker suffixes | `L2-142` | To do |
| 21 | [21-chapter-tagged-roles-and-scoped-granting.md](21-chapter-tagged-roles-and-scoped-granting.md) | "{role} · {chapter}", chapter-scoped grantors | `L2-141` AC3, `L2-138` AC6, `L2-143` | To do |
| 22 | [22-partner-stages.md](22-partner-stages.md) | Stages list, board columns, counting by kind, Stages & types tab | `L2-144` | To do |
| 23 | [23-event-types.md](23-event-types.md) | Event types list, form and filter | `L2-145` | To do |
| 24 | [24-resource-types.md](24-resource-types.md) | Resource types list, guess by key | `L2-146` | To do |
| 25 | [25-organisation-audit-categories-and-read-scope.md](25-organisation-audit-categories-and-read-scope.md) | Audit categories, partial read scope | `L2-152` AC2, AC3 | To do |
| 26 | [26-platform-operators-audit-and-account-lock.md](26-platform-operators-audit-and-account-lock.md) | Operators, platform audit, account lock | `L2-148`, `L2-132` AC6, `L2-152` AC4 | To do |
| 27 | [27-provision-an-organisation.md](27-provision-an-organisation.md) | `org create` and the operator API | `L2-149` | To do |
| 28 | [28-suspend-and-lift-an-organisation.md](28-suspend-and-lift-an-organisation.md) | Suspend and lift, workers skip | `L2-150` | To do |
| 29 | [29-faithtech-regression-and-close-out.md](29-faithtech-regression-and-close-out.md) | `grant-admin` by slug, production seed, regression sweep, journeys, estimates | `L2-151` AC5, AC6 | To do |

Every acceptance criterion from `L2-130` to `L2-152` is assigned to at least one slice. If a criterion is split, each
slice says which half it owns. When a slice merges, its prompt changes its row to "Done".

## Deferred

Everything in the proposal's "Deferred" list is out of scope for every slice. That includes chapter-targeted
announcement audiences, a per-organisation private-preview wall, branding, automated custom hosts, an audited operator
read of organisation data, self-service sign-up, role templates, chapter hierarchies and renaming the repository.
