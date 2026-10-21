# 0003. An unlinked private contact is never resolvable as a profile

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-005 AC3
- Design: `docs/detailed-designs/profiles/view-profile`

## Context

L2-005 AC3: a private contact that has not been linked must answer 404 to anyone other than its owner or a System Admin when requested as a profile. The design said the profile handler would check contact ownership. Contacts and profiles are separate aggregates (`Contact`, `Profile`); a contact becomes a member only when the person signs up and the contact is linked to their new profile (`Contact.LinkedProfileId`).

## Decision

- `GET /api/profiles/{id}` reads only the `Profiles` set. A contact id is never a profile id, so a request for an unlinked contact as a profile answers **404 to every caller**, with the same body as any unknown id. Nothing in the response reveals that a contact exists.
- The owner and System Admin read a private contact through the contacts API (L2-012 and following), not the profile API, so they lose nothing.
- Once a contact is linked, the person is reached through their own profile id like any other member.

## Consequences

- The profile handler needs no knowledge of contacts and cannot leak them; there is no ownership branch to get wrong.
- This is stricter than the original design wording (owner and System Admin also get 404 from the profile API). The design's open questions record the change.
