# 0042. Hackathon sections are optional kinds, and hub files come from Resources

- Status: Accepted
- Date: 2026-11-01
- Requirements: L1-008, L2-172 to L2-183
- Designs: `docs/detailed-designs/events/build-hackathon-hub`
- Proposal: `docs/proposals/event-hubs.md`
- Supersedes in part: ADR 0036 (a kind added later is added to every existing hub)
- Refines: ADR 0038 (section content is what the lead types), ADR 0040 (visitors read the hub through one endpoint),
  ADR 0041 (a starting point replaces the hub's sections)

## Context

Phase 2 of the proposal adds ten section kinds a hackathon needs: Parking, What to bring, Partners, Tracks, Process, Rules,
Demo format, Judging and honors, Worship and Slides. Most events are not hackathons. Four things had to be settled: whether every
hub carries all seventeen kinds, where parking maps and slides live and how visitors reach them, what a Partners section copies
from Partners, and how FaithTech's existing Hackathon template gains the new defaults.

## Decision

- **The ten kinds are optional.** A hub always holds the seven phase 1 kinds (the core) and holds an optional kind only when
  its starting point brings it: a template that names it, or a copied hub that has it. Blank is the core seven, as before. A
  starting point applied again removes optional sections it doesn't bring. The catalogue has one order for all seventeen,
  with the core keeping its relative order, so existing hubs read exactly as they did. Unlike ADR 0036 planned, the new kinds
  are not added to existing hubs, hidden or otherwise, and no migration touches them.
- **Kinds stay one enum, stored as strings.** The enum is reordered into catalogue order; nothing stores its numbers. The
  core set is a list beside it, not a property of the database.
- **Images and slides are Resources.** Parking maps and slides are resource ids. The wizard picks from Resources or uploads
  through the Resources API, which files the upload as an organisation-wide (Global) resource owned by the lead, so it can be found and reused. (Shared needs a named audience, which an upload from a wizard does not have.)
  Visitors get the bytes through the hub: `GET /api/events/{id}/hub/files/{resourceId}` (and `/thumbnail`) answers only for a
  resource a shown section of that hub names, to exactly the callers who may see the hub's page (ADR 0040). Putting a
  resource on a published hub is the lead's decision to show it, so the resource's own visibility does not apply there, and no
  other resource can be reached this way.
- **Partners are read live.** The section stores partner ids and the lead's paragraph. The page reads each partner's name,
  offering and website from Partners on every request, and leaves out a partner archived or merged away. Partners has no logo,
  so the page shows initials in an icon tile; logos are deferred to Partners.
- **Lists have limits and the two totals are rules.** Every list has a maximum, every text a length. Demo segments must fit
  the demo's minutes and judging weights must total 100%: both are validated in Application, shown live in the wizard and
  refused on the step.
- **The seed upgrades only an untouched template.** The Hackathon template FaithTech already has gains the ten kinds and
  their defaults when its stored sections are exactly what slice 45 seeded; a template an administrator has edited (slice 47)
  is left alone.
- **Custom text is deferred** (proposal open question 2). Every SoCal section has a kind, so nothing needs it yet.

## Consequences

- Existing hubs and every existing journey behave as before: Blank hubs keep seven sections.
- A lead who started from Meetup, Workshop or Blank cannot add an optional section to that hub yet; "Add a section" on the hub
  home is deferred. Choosing Hackathon or copying a hackathon's hub gives every kind.
- Removing an optional section's resource from Resources (archive and purge) removes it from the hub page: the hub file
  endpoint answers 404 and the page leaves the image out.
- The section content API, the fake and the frontend registry each gain ten schemas; their limits are listed once in the
  design and kept in step.
