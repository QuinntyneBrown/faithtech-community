# 0007. Team list filters, order and photos

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-019, L2-005
- Designs: `docs/detailed-designs/team/team-list`

## Context

L2-019 asks for a team list with name, photo and roles, a role filter (Leads or Volunteers) and a city filter. The design left the sort order and paging open, the mocks showed a city preselected without saying which, and the design system said avatars carry initials only, while the requirement asks for a photo.

## Decision

- Membership stays derived from roles (`TeamRoles.IsTeamMember`) on every request; nothing is stored, so a profile that loses its last team role drops off at once.
- `GET /api/team?role=Leads|Volunteers&city=` requires a signed-in caller. **Leads** are City, Event, Create and Communications Lead (`TeamRoles.Leads`); **Volunteers** is the Volunteer role. An unknown role filter answers `400`.
- The city filter matches the profile's home city, ignoring case and surrounding spaces. It is a filter, not a permission boundary: data stays global.
- The response is `{ members, cities }`. `cities` lists every team member's home city, whatever the filters, so the city select keeps its options while filtered.
- Members are sorted by name (case-insensitive). There is no paging: the team is a few dozen people per city; paging is deferred until it is not.
- Each member carries every role they hold (a Create Lead who is also a Product Engineer shows both badges) and the URL of their featured photo, or `null`.
- The avatar component gains a photo: with `src` it shows the image (decorative, `alt=""`, because the name is printed beside it) and falls back to initials without one.
- The page opens on **All** and **All cities**. Leads and System Admins see **Invite someone**, a link to `/invites`, because the team library cannot depend on the invites library.
- Suspended profiles still appear while they hold a team role; hiding them is deferred to the admin subsystem.

## Consequences

- One request serves both filters and the city options.
- A team that outgrows one page needs paging added to the endpoint and the page.
- The team page shares the avatar, button and form field with the initial bundle, so esbuild splits the shared chunk in two and the initial bundle grows about 1.3 kB to 500.9 kB, from 499.7 kB on `main`, with no new initial code. The initial bundle's warning budget moves from 500 kB to 510 kB; the 1 MB error budget is unchanged.
