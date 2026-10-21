# 0009. Shell navigation follows one rule by role

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-045 AC4, L2-012, L2-017, L2-019, L2-030, L2-040, L2-053
- Designs: `docs/detailed-designs/platform/responsive-layout-and-theming`
- Mocks: every signed-in page (`docs/design-system/components/tab-bar.html`, `top-bar.html`, `patterns/navigation.html`)

## Context

The mocks hand-copied the top bar and tab bar per persona, and the sets disagreed: Staff swapped Contacts for Workspaces, a Communications Lead had Workspaces and Announcements tabs, a System Admin had Contacts and Admin, and a member with no role saw only Home and Events although every member may open Team and Announcements. The app shell showed the same sections to everyone.

## Decision

- One ordered list of sections, each with the roles that may open it, lives in the app shell (`frontend/projects/faithtech-community/src/app/shell/navigation.ts`). The top bar, the tab bar and the menu are all built from it, so they cannot disagree.
  - Home, Events, Team, Announcements: every member.
  - Contacts: any lead role or System Admin (private contacts, L2-012).
  - Partners: any lead role, Staff or System Admin (L2-017).
  - Workspaces (mocks only until the Agile feature has a route): any lead role, Volunteer, Staff or System Admin.
  - People: City Lead, Staff or System Admin (L2-053).
  - Admin: System Admin (L2-040).
- The phone tab bar is Home, Events, Search, the member's next section, then **More**: a button that opens the menu (nav drawer) of every section the member may open. More is the current tab (`aria-current="true"`) whenever the page is outside the four link tabs, so a phone user always sees where they are.
- Hiding a section is a convenience only; the API still refuses what a role may not open.
- The mocks are regenerated from the same rule per persona, so each persona's bar matches what the app renders.

## Consequences

- A new section or role change is one edit in `navigation.ts`, plus the mocks.
- The client copy of the rule can drift from the server; the server stays the authority.
