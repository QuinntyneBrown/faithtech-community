# 0041. A starting point replaces the hub's sections, and templates are organisation rows with JSON sections

- Status: Accepted
- Date: 2026-11-01
- Requirements: L1-008, L2-169 to L2-171
- Designs: `docs/detailed-designs/events/start-hub-from-template`
- Proposal: `docs/proposals/event-hubs.md`
- Refines: ADR 0036 (event hubs are children of events), ADR 0038 (agenda times)

## Context

Step 2 of the Create event hub wizard offered only **Blank** (slice 41). Slice 45 adds the organisation's templates and
**Copy a past hub**. Four things had to be settled: how a template is stored without code naming it, how an Agenda can have
default times when a template knows no event, how applying a starting point fits the wizard's save-as-you-go, and what a
copy carries over.

## Decision

- **A template is an organisation row with its sections as JSON.** `HubTemplate` has a name, a description, its place in the
  list and one `jsonb` array of `{ kind, visible, content }`. Content takes the kind's own shape, so the same readers and,
  later, the same validators serve both. FaithTech's three templates are seed rows with fixed ids, added when missing.
- **Agenda defaults are minutes from the event's start.** A template row holds `minutes`, turned into
  `event.StartsAt + minutes` when applied. That keeps the instant rule of ADR 0038 and needs no time zone.
- **Applying is its own command, and it replaces.** `POST /api/events/{id}/hub/start` sets every section's visibility, order
  and content. Step 2's Next calls it, before the lead has filled anything, so replacing loses nothing but the previous
  choice's defaults, and going Back to choose again behaves as the lead expects. The wizard's save keeps doing one job
  (which sections are shown) and its starting point becomes optional.
- **A copy shifts by the difference of the starts.** Every section is copied with its visibility, order and content; Agenda
  rows and the code-freeze time move by `new.StartsAt − source.StartsAt`, so a hub's day keeps its shape. People and links
  come too. The copy is a Draft.
- **The starting point is recorded as a key**: the template's id, `blank` or `copy`. Nothing reads it yet beyond the audit
  log; it is there for reporting and for slice 47.

## Consequences

- Provisioning stays as it is: a new organisation has no templates until slice 47 lets it make them, and step 2 offers
  **Blank** and **Copy** alone.
- Adding a section kind (slice 46) means adding its defaults to the seed rows, not a migration of the template table.
- Applying a starting point after sections were filled would overwrite them; the wizard only offers it before filling,
  and the hub home never does.

## Alternatives considered

- **A table of template sections.** Rejected: more joins and migrations for data that is always read and written whole.
- **Templates in code or configuration.** Rejected: AGENTS.md forbids naming FaithTech's data in code, and slice 47 edits
  them per organisation.
- **Applying through the wizard's save, with the key.** Rejected: every later save would re-apply and wipe the lead's
  ticks, and the save would have two jobs.
- **Filling only empty sections when applying.** Rejected: going Back and choosing another template would keep the first
  template's text.
