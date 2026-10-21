# Partner Kanban board

## Overview

The partner pipeline is shown as a **Kanban board** — view of work items arranged in columns by stage. The partner board has three columns, in order: Lead, In Funnel and Confirmed, each with a count. A lead moves a partner to another stage by dragging its card, by the "Move to" dialog, or by keyboard alone. Each move is recorded with who made it and when.

At extra-small viewports the board shows the stages as tabs with one column visible at a time.

## Description

- **`PartnersPage`** — board page in the `partners` feature library. It groups partners by stage and renders one Kanban column per stage, or, on phones (below the 640px `sm` breakpoint, which covers XS), stage tabs (`TabsComponent`) with one column visible at a time (mock `pages/partners/tabs`).
- **Kanban column and card components** — from the `components` library, built on Angular CDK drag and drop. A focused card exposes a Move action reachable by keyboard.
- **`MovePartnerDialog`** — CDK dialog listing the other stages; used from the card's Move to action and as the keyboard path.
- **`PartnersService`** — `list()` and `move(id, stage)` calling `GET /api/partners` and `POST /api/partners/{id}/stage`.
- **`PartnersEndpoints`** — maps the board routes.
- **`ListPartnersQuery`** / **`ListPartnersHandler`** — returns partners with counts per stage; requires `PartnerAccessPolicy.CanRead`.
- **`MovePartnerCommand`** / **`MovePartnerHandler`** — requires `CanWrite`, calls `Partner.MoveTo`, which appends a `PartnerStageChange` with `From`, `To`, `MovedBy`, `MovedAtUtc` and the optional `Note` (`L2-018` AC2).
- Stage moves are not restricted to adjacent stages; any stage may move to any other.

Behaviour when two leads move the same card at the same time: last write wins, with no concurrency token ([ADR 0007](../../../adr/0007-contacts-and-partners-access-and-open-questions.md)).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-018` | `L1-006` | Partner Kanban board |

### Acceptance criteria

**`L2-018` — Partner Kanban board**

1. Given the partners page, when it loads, then partners appear in three columns, Lead, In Funnel and Confirmed, each with a count.
2. Given a lead, when they drag a partner to another column, or use the "Move to" dialog with an optional note, then its stage changes and the move is recorded in the partner's history with who made it, when, and the note.
3. Given a keyboard-only user, when they focus a partner card, then they can move it to another stage without a pointer.
4. Given an XS viewport, when the board is shown, then the stages are shown as tabs with one column visible at a time.

## Diagrams

### System context

Leads move partners on the board; Staff view the board read-only.

![C4 system context for partner kanban board](diagrams/c4-context.png)

### Containers

The `partners` feature library in the Angular web app calls the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for partner kanban board](diagrams/c4-container.png)

### Components

The page composes library Kanban components; moves go through `MovePartnerHandler`, which records the change on `Partner`.

![C4 component view for partner kanban board](diagrams/c4-component.png)

### Class structure

`Partner.MoveTo` appends a `PartnerStageChange`. Both handlers depend on `PartnerAccessPolicy`.

![Class diagram for partner kanban board](diagrams/class-structure.png)

### Behaviour — load the board

The board loads three columns with counts; at XS the page renders tabs (`L2-018` AC1, AC4).

![Sequence diagram for load the board](diagrams/sequence-load-board.png)

### Behaviour — move a partner

Drag, the Move to dialog and the keyboard path all send the same command; the move is recorded with actor and time (`L2-018` AC2, AC3).

![Sequence diagram for move a partner](diagrams/sequence-move-partner.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- Moving a partner to the stage it is already in is rejected and records no history. Domain rule violations throw `InvalidOperationException` (a broken rule) or `ArgumentException` (invalid input); there is no shared domain exception type. Handlers check permissions and preconditions first and map any remaining violation to a `400` or `409` result.
- At XS the page composes `TabsComponent` with one `KanbanColumnComponent`; the mock gained a `tabs` state.
