# Team list

## Overview

The **team** — everyone in the organisation who holds a role whose definition is flagged `ShowOnTeam` (`L2-136`; seeded as the lead roles and Volunteer in FaithTech). Team membership is derived from roles, not stored separately: a profile joins the team when it gains one of those roles and leaves when it loses the last one.

The team page lets any signed-in member see who the team is, with name, photo and roles, and filter by role and, when the organisation has chapters, by {chapter} (`L2-142`). The `team-board` mock is a separate Agile workspace screen and is outside this slice.

## Description

- **`TeamPage`** — page at `/team` in the `team` feature library. It lists team members in a list card with avatar (featured photo, initials without one), name linking to the profile and role badges reading "{role} · {chapter}" when tagged (`L2-141` AC3), and offers a role select (All roles and the organisation's non-archived roles flagged `ShowOnTeam`) and, when chapters are on, a {chapter} select ("All {Chapters}" and the active chapters from `GET /api/organisation`, `L2-142` AC1). Holders of `InviteMembers` see **Invite someone**, a link to `/invites`.
- **`TeamService`** / **`TEAM_SERVICE`** / **`HttpTeamService`** — API client calling `GET /api/team?role=&chapter=`.
- **`TeamEndpoints`** — minimal API mapping requiring an authenticated caller (`401` anonymous).
- **`ListTeamQuery`** (`RoleId?`, `ChapterId?`) and **`ListTeamHandler`** in Application `Team/`. The handler selects the organisation's profiles holding a non-archived `RoleDefinition` flagged `ShowOnTeam`, narrowed to one such role and to a home {chapter} (`Profile.ChapterId`), sorted by name. Every query is scoped by the DbContext's global filter on `ICurrentOrganisation`.
- **`RoleDefinition.ShowOnTeam`** — the flag on the organisation's role definitions that replaces the deleted `TeamRoles` constant sets (ADR 0033, ADR 0034). `TeamRoles.IsTeamMember(profile)` goes with them; the Agile workspace membership rule reads `JoinWorkspaces` instead.
- **`TeamListDto`** — `Members` (`TeamMemberDto`); the role and {chapter} filter options come from `GET /api/organisation`, not from the list (`L2-142` AC1).
- **`TeamMemberDto`** — `ProfileId`, `Name`, `Chapter` (the home {chapter} name or `null`), `PhotoUrl` (featured photo or `null`), `Roles` (every role held: definition id, name and {chapter} tag).

Sorted by name, opening on All roles and All {Chapters} ([ADR 0007](../../../adr/0007-team-list-filters-and-photos.md), refined by ADR 0034). Paged by [ADR 0015](../../../adr/0015-team-list-paging.md), refined by ADR 0034: `GET /api/team?role=&chapter=&after=&pageSize=` returns `{ members, next, totalCount }`, 50 by default and at most 100. Filters and the order by lower-cased name, then id, run in the database before paging, and `next` is a keyset continuation. The {chapter} filter lists every active {chapter} whatever the page (`L2-142` AC1). `TeamPage` shows "Showing N of M members" (`role="status"`) and *Show more members*. A failed continuation keeps the list, shows a danger `ft-alert`, "We couldn’t load more members. Try again.", and the button tries again (mock states `more` and `more-error`).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-019` | `L1-007` | Team list |
| `L2-142` | `L1-027`, `L1-007`, `L1-008`, `L1-024` | Chapter filters |

### Acceptance criteria

**`L2-019` — Team list**

1. Given any signed-in member, when they open the team page, then it lists every profile holding a role whose definition is flagged "shown on the team list" (`L2-136`), with name, photo and roles, each role with its {chapter} tag when it has one (`L2-141` AC3).
2. Given a role filter (listing the organisation's non-archived roles flagged for the team list; seeded as the lead roles and Volunteer in FaithTech, `L2-151`) or a {chapter} filter (`L2-142`, absent when chapters are off), when it is applied, then only matching team members are listed.
3. Given a profile that loses its last team-list role, when the team page is viewed, then that profile no longer appears.
4. Given more than 50 matching team members, when the team page opens, then it shows the first 50 by name with "Showing 50 of N members", and "Show more members" loads the next 50 (at most 100 a page, `L2-046`) with the filters applied before paging, never repeating or skipping a member; the {chapter} filter still lists every active {chapter} (`L2-142` AC1); when loading more fails, the members already shown stay and "We couldn’t load more members. Try again." is shown.

**`L2-142` — Chapter filters**

1. Given chapters are on, when the team list (`L2-019`), the event list (`L2-021`), People (`L2-053`) and Reports (`L2-124`) render their filter, then it offers "All {Chapters}" and the active chapters in order, from `GET /api/organisation`, in place of the former distinct-city lists, and the URL carries `chapter=` in place of `city=`.
2. Given a chapter filter, when it is applied, then only records tagged with that chapter are listed, and an event with no chapter appears only under "All {Chapters}" and under "{Organisation}-wide" when that option is offered (events only).
3. Given chapters are off, when those pages render, then the filter is absent and the lists are organisation-wide.
4. Given a people picker or share picker that shows a person's role and city (`L2-056` AC4, `L2-061` AC1, `L2-064` AC3, `L2-093` AC2), when it renders, then it shows "{name} · {role} · {chapter}", omitting what is missing.
5. Given an empty result for a chapter, when the list renders, then the empty state names the chapter ("No upcoming events in Toronto").

## Diagrams

### System context

Any signed-in member views the team. No external system takes part; anonymous visitors cannot see profiles (`L2-005`).

![C4 system context for team list](diagrams/c4-context.png)

### Containers

The `team` feature library in the Angular web app calls the Community API over HTTPS with an OAuth2 bearer token. The API persists state in the PostgreSQL Community database.

![C4 container view for team list](diagrams/c4-container.png)

### Components

`ListTeamHandler` derives membership from the `ShowOnTeam` flag of the organisation's role definitions on every request, so role and definition changes take effect at once.

![C4 component view for team list](diagrams/c4-component.png)

### Class structure

`ListTeamHandler` reads `Profile` roles joined to `RoleDefinition`, keeps those flagged `ShowOnTeam`, and returns `TeamMemberDto` items.

![Class diagram for team list](diagrams/class-structure.png)

### Behaviour — view and filter the team

Membership is computed from current roles, so a profile that loses its last team role drops out on the next view (`L2-019` AC3).

![Sequence diagram for view and filter the team](diagrams/sequence-view-team.png)

## Open questions

Decisions recorded while building the Domain layer (`FaithTech.Community.Domain`):

- Team membership stays derived from roles; nothing is stored. Resolved.
- Capabilities and chapters: `TeamRoles` is deleted; membership is the `ShowOnTeam` flag on the organisation's role definitions, the role filter lists those roles, and the city filter becomes the {chapter} filter fed by `GET /api/organisation`, refining ADR 0007 and ADR 0015 (ADR 0033, ADR 0034).
- Sort order, filter values, the default city and the photo avatar: resolved in [ADR 0007](../../../adr/0007-team-list-filters-and-photos.md). Paging: resolved in [ADR 0015](../../../adr/0015-team-list-paging.md).
- Hiding suspended profiles from the team: deferred to the admin subsystem.
