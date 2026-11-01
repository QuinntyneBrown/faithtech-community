# 0039. The hub preview is the public hub route, and publishing refuses nothing

- Status: Accepted
- Date: 2026-11-01
- Requirements: L1-008, L2-163 to L2-165
- Designs: `docs/detailed-designs/events/preview-and-publish-hub`
- Proposal: `docs/proposals/event-hubs.md`
- Refines: ADR 0036 (event hubs are children of events, rendered from sections), ADR 0038 (hub section content schemas)

## Context

The proposal asks for the real generated page one tap away on every wizard step and on the hub home, then Publish, Unpublish
and Share, with every publish and unpublish audited. It leaves open whether publishing should notify the event's RSVPs. Slice 43
has to decide where the preview renders, what it shows from a half-finished hub, what publishing checks, what is audited, and
how a wizard's preview relates to input that has not been saved.

## Decision

- **One route for the preview and the public page.** The hub page is `/public/events/:id/hub` in the events library's public
  routes, rendered from the hub's data with the slice-42 display components. A holder of `ManageEventHubs` sees it in preview
  mode, under a "Preview" banner, whether the hub is a draft or published. In this slice the page reads through the manager
  endpoint `GET /api/events/{id}/hub`; slice 44 adds the anonymous and member read without changing the page.
- **Only shown sections render.** A section appears when it is visible and Ready; Upcoming events also needs at least one event.
  Hidden sections and sections that need information are left out, so there is never an empty heading.
- **Publishing refuses nothing.** Publish needs only `ManageEventHubs`; empty sections are simply left out of the page (design
  rule 3). Publish sets Published and `PublishedAt = now`, also on a hub that is already published. Unpublish returns the hub to
  Draft, clears `PublishedAt` and keeps every section.
- **Audit every status change.** `event_hub.published` and `event_hub.unpublished` are recorded for every change, with
  `Override` true when only `AdministerOrganisation` allowed it. Unpublishing a draft changes nothing and records nothing.
- **The wizard preview shows what is saved.** Wizards save on every Next, Save and finish later and Save, so the Preview link
  opens the hub page in a new tab and the wizard stays open with its input.
- **No notification on publish.** Publishing does not notify the event's RSVPs (proposal open question 5, default no). It is
  deferred until people ask for it.

## Consequences

- The preview cannot drift from the public page: there is one page, one set of display components and one source of data.
- Publishing is a single click; the checklist, not a publish-time validation, tells a lead what is missing.
- A lead previewing from a wizard sees the last saved state, not the field they are typing in.
- Slice 44 only has to add a read endpoint with the visibility rules and hide the banner for visitors.

## Alternatives considered

- **A separate preview route inside the app shell.** Rejected: a second page to keep in step with the public one.
- **Blocking publish until every visible section is Ready.** Rejected: contradicts "nothing is required except the event"; the
  page leaves empty sections out instead.
- **Previewing unsaved wizard input in a dialog.** Rejected: it would render outside the real page, which is what the preview
  exists to show.
