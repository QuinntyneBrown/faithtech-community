# 0008. Avatar colour from the profile id

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-005 AC4
- Designs: `docs/detailed-designs/profiles/view-profile`, `docs/design-system/components/avatar.html`

## Context

The design system says a person keeps one avatar colour on every screen, but the mocks picked colours per screen, so the same person drifted between colours and the app drew every avatar plain. Nothing stored a colour for a member. The palette has seven person colours (sky, sun, lilac, sage, rose, mint, peach) and far more members than that, so two people will always share some colours.

## Decision

- A member's avatar colour is derived, not stored: `avatarColorFor(profileId)` in the `components` library hashes the lower-cased profile id (32-bit FNV-1a) onto the seven colours in a fixed order. Every screen that shows the member passes their profile id, so every screen computes the same colour.
- No id means the plain avatar: private contacts who have not signed up. A suspended account also shows plain.
- `GET /api/me` returns the caller's `profileId`, so the top-bar avatar uses the same key as the profile page.
- Colours repeat by design. The avatar is always decorative and the name is printed beside it, so the colour only helps scanning; it never identifies a person.

## Consequences

- No migration or column, and the colour cannot drift between screens or devices.
- A member cannot choose their colour. Choosing one later would mean storing it on `Profile` and returning it in the DTOs that carry a profile id.
- Changing the palette's size or order reassigns most members' colours.
- The mocks' cast colours (`docs/mocks/README.md`) are illustrative; real colours come from real ids.
