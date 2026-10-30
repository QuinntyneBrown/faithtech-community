# Manage partners

## Overview

A **partner** — organization the current organisation works with or hopes to work with, such as a church, company or school. Holders of `ManagePartners` track partners in one shared **partner pipeline** — the single set of partner records every holder of `ViewPartners` sees and works on together, with no per-member or per-chapter copies.

This feature covers creating, viewing and editing partner records. A new partner enters the pipeline at the organisation's initial stage (`L2-144` AC3). A holder of `ViewPartners` without `ManagePartners` can see the pipeline but not change it; a caller without the write capability answers 403. Every query is scoped to the current organisation by the DbContext's global filter on `ICurrentOrganisation`. Moving partners between stages is the `partners/partner-kanban-board` slice. The partner's activity timeline, which replaced the Stage history list, is `partners/partner-activity-timeline`; possible duplicates, merge, archive and restore are `partners/duplicate-detection-and-merge`.

## Description

- **`PartnersPage`** — the board page in the `partners` feature library at `/partners` (see `partners/partner-kanban-board`); it hosts the Add partner action, opens `AddPartnerDialog` and places the new card in its stage column with a "{name} added to the pipeline" toast.
- **`AddPartnerDialog`** — CDK dialog collecting name (required), website, offering, owner (a member holding `ManagePartners`, from `owners()`), main contact, email, phone, notes and stage (the organisation's initial stage by default, from the active stages in `GET /api/organisation`). It calls `PARTNERS_SERVICE.create` itself, shows field errors and a failed state, and closes with the new `PartnerDto`.
- **`PartnerPage`** — partner detail page at `/partners/:id` with the details and the activity timeline (`partners/partner-activity-timeline`), which replaced the stage history list. Edit navigates to `PartnerFormPage`; Move opens `MovePartnerDialog`. Both are hidden when `canEdit` is false (a caller without `ManagePartners`, or an archived partner). A `404` shows the not-found state.
- **`PartnerFormPage`** — edit screen at `/partners/:id/edit` (mock `pages/partner-form`) with the same fields as `AddPartnerDialog` except the stage, which changes only by a move. It shows a read-only state when `canEdit` is false and an error summary with focus on the first invalid field.
- **`partner-fields.ts`** — the form group, `fromPartner`, `toRequest`, `clientErrors`, `serverErrors` and `ownerOptions` that the dialog and the form page share.
- **`PartnersService`** / **`PARTNERS_SERVICE`** / **`HttpPartnersService`** — API client in `api/src/lib/partners`: `getBoard()`, `get(id)`, `owners()`, `create(partner)`, `update(id, partner)` and `move(id, to, note)`, calling `GET /api/partners`, `GET /api/partners/{id}`, `GET /api/partners/owners`, `POST /api/partners`, `PUT /api/partners/{id}` and `POST /api/partners/{id}/stage`.
- **`PartnersEndpoints`** — minimal API mapping in `FaithTech.Community.Api`; it holds no business logic. Create answers `201`, `400` or `403`; get answers `200`, `403` or `404`; update answers `200`, `400`, `403` or `404`; owners answers `200` or `403`.
- **`PartnerCommand`** — one request body for create and update (`Name`, `Website`, `Offering`, `OwnerId`, `ContactName`, `Email`, `Phone`, `Notes`, `Stage`); `Stage` applies on create only.
- **`PartnerValidator`** and **`PartnerRules`** — a name is required ("Enter the organisation’s name."), the email must be well formed when present, other fields are at most 200 characters, notes at most 2,000, and a stage must be the key of one of the organisation's active partner stages (`L2-144`).
- **`ManagePartnersHandler`** — Application handler in `Partners/` with `CreateAsync`, `GetAsync`, `UpdateAsync`, `BoardAsync` (see `partners/partner-kanban-board`) and `OwnersAsync`. `CreateAsync` also writes the system Added activity ("Added {name} on {initial stage name}") in the same `SaveChanges` (`L2-110` AC6). `UpdateAsync` increments `Partner.Version` and answers `409` for an archived partner (ADR 0028).
- **`PartnerAccess`** — Application permission check. `CanRead`: `ICurrentUser.Has(Capability.ViewPartners)` or `Has(Capability.ManagePartners)`; `CanWrite`: `Has(Capability.ManagePartners)`. Others receive `403`. `AuditAdminWrite(...)` records `partner.created` and `partner.updated` (target type `Partner`) when the change is an override, `AuthorizationRules.IsOverride(actor, ManagePartners)`: a holder of `AdministerOrganisation` without `ManagePartners` (`L2-135` AC5).
- **`PartnerViews`** — builds **`PartnerDto`** with the owner's name and `CanEdit` from `PartnerAccess.CanWrite`. The `History` list of `PartnerStageChangeDto` rows is removed: stage moves appear on the timeline as Stage moved entries, and `PartnerDto` gains `Version`, `LastActivityOn`, `NextStep`, `NextStepDue` and `CanLogActivity` (`partners/partner-activity-timeline`) and `Archived` and `CanRestore` (`partners/duplicate-detection-and-merge`).
- **Owner** — optional; it must be a member of the organisation whose current capabilities include `ManagePartners`, otherwise `400` "Choose someone who can manage partners as the owner." `OwnersAsync` lists those members by name as **`PartnerOwnerDto`**.
- **`Partner`** — Domain entity; `StageKey` references one of the organisation's `PartnerStage` list entries by key (ADR 0035), and new partners start on the entry flagged `IsInitial` unless another active stage is chosen. `Update(...)` edits the details but never the stage. `CommunityDbContext` maps it to `Partners` with the stage key stored as text.

Which members may write partners: `decisions.txt` lists partners under one role, and [ADR 0014](../../../adr/0014-contacts-and-partners-access-and-open-questions.md) widened that to every lead role. ADR 0033 refines both: `PartnerAccess` grants reads to `ViewPartners` and writes to `ManagePartners`, whichever of the organisation's role definitions carry them (seeded as the lead roles in FaithTech).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-017` | `L1-006` | Partner records |
| `L2-144` | `L1-028`, `L1-006` | Partner stages |

### Acceptance criteria

**`L2-017` — Partner records**

Partners are read by holders of `ViewPartners` and written by holders of `ManagePartners` (`L2-135`). A holder of `AdministerOrganisation` may do either without the capability, audited as an override (`L2-135` AC5).

1. Given a holder of `ManagePartners`, when they add a partner with a name, an optional website, offering, owner (a member holding `ManagePartners`), contact details and notes, and a stage (the organisation's initial stage by default, `L2-144` AC3; seeded as Lead, In Funnel and Confirmed in FaithTech, `L2-151`), then the partner appears in that stage.
2. Given a partner, when any holder of `ViewPartners` views it, then every holder sees the same record (one shared pipeline across the organisation).
3. Given a holder of `ViewPartners` without `ManagePartners`, when they view partners, then they cannot create, edit or move partners, and the API returns 403 for writes.
4. Given a member without `ViewPartners`, when they request partners, then the response is 403.

**`L2-144` — Partner stages**

1. Given a holder of `ManageOrganisationSettings` on Stages & types (`/organisation/taxonomies`), when they view "Partner stages", then it lists the active stages in order with their partner counts, which is the initial stage, and each stage's kind (Open or Confirmed), and offers add, rename, reorder, set as initial, set kind and archive; the writes are under `/api/organisation/partner-stages` and audited under `taxonomies`.
2. Given the stages, when they are saved, then exactly one active stage is initial, at least one active stage exists, and a name is required, up to 40 characters and unique among active stages ignoring case; a violation answers 400 with an inline error.
3. Given the Kanban board (`L2-018`), when it renders, then it shows one column per active stage in order (tabs on XS) with that stage's partners, and a new partner (`L2-017` AC1) starts on the initial stage.
4. Given a partner on an archived stage, when the board renders, then it is listed in an "Archived stage: {name}" column at the end until moved; moving a partner onto an archived stage is refused with 400.
5. Given Home's pipeline card (`L2-049` AC6) and Reports' "partners confirmed" (`L2-125`), when they count, then they count partners whose stage kind is Confirmed, and show one count per active stage.
6. Given the stage history, merge dialog and timeline "Stage moves" (`L2-017`, `L2-111`, `L2-114`), when a stage is renamed, then history shows the current name; when archived, then history shows the name with "(archived)".
7. Given a stage with partners, when it is archived, then the request is refused with 409 "{n} partners are on this stage. Move them first." (an archived stage keeps no partners).

## Diagrams

### System context

Holders of `ManagePartners` create and edit partners; holders of `ViewPartners` alone view them read-only. All see the same shared pipeline.

![C4 system context for manage partners](diagrams/c4-context.png)

### Containers

The `partners` feature library in the Angular web app calls the Community API through the `api` library over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for manage partners](diagrams/c4-container.png)

### Components

`PartnerValidator` rejects bad bodies with `400`; `ManagePartnersHandler` consults `PartnerAccess` before touching the shared pipeline, builds DTOs through `PartnerViews` and saves through `CommunityDbContext`.

![C4 component view for manage partners](diagrams/c4-component.png)

### Class structure

`Partner` references one of the organisation's `PartnerStage` entries by key and composes its stage history. `PartnerAccess` separates `ViewPartners` from `ManagePartners` through `ICurrentUser.Has`; `ManagePartnersHandler` handles `PartnerCommand` and returns `PartnerDto` from `PartnerViews`.

![Class diagram for manage partners](diagrams/class-structure.png)

### Behaviour — add a partner

A holder of `ManagePartners` creates a partner that enters the chosen stage, the organisation's initial stage by default; callers without `ManagePartners` receive `403`, and an owner without `ManagePartners` is `400`.

![Sequence diagram for add a partner](diagrams/sequence-add-partner.png)

### Behaviour — view a partner

Every permitted reader sees the same shared record (`L2-017` AC2) with its activity timeline. A holder of `ManagePartners` can go on to edit it on `PartnerFormPage`.

![Sequence diagram for view a partner](diagrams/sequence-view-partner.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- `L2-017` adds website, offering and an owner (a member who can manage partners) to a partner; `Partner` carries `Website`, `Offering` and `OwnerId`. Resolved.
- Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
- Edit navigates to the new partner form page (`/partners/:id/edit`, mock `pages/partner-form`); the add-partner dialog mock gained website, owner, phone and notes, and the partner page showed stage history without an inline note form ([ADR 0014](../../../adr/0014-contacts-and-partners-access-and-open-questions.md)). The stage history list is now replaced by the activity timeline (`partners/partner-activity-timeline`).
- Only an override (a holder of `AdministerOrganisation` acting without `ManagePartners`) is audited (`partner.created`, `partner.updated`); a holder of `ManagePartners` is not audited, and their moves are recorded in the partner's own stage history and on its timeline as Stage moved entries.
- Capabilities: the lead-role comparison in `PartnerAccess` and the `LeadRoles` owner check are superseded by `ViewPartners` and `ManagePartners`, and the fixed `PartnerStage` enumeration by the organisation's stage list (ADR 0033, ADR 0035).
