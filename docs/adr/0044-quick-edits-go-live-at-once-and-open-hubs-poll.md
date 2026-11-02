# 0044. Quick edits go live at once, and open hubs poll for changes

- Status: Accepted
- Date: 2026-11-02
- Requirements: L1-008, L2-188 to L2-192
- Designs: `docs/detailed-designs/events/run-the-day-from-a-phone`
- Proposal: `docs/proposals/event-hubs.md` (phase 3, "Run the day from a phone")
- Refines: ADR 0036 (hubs read the event's facts), ADR 0038 (section content), ADR 0012 (Agile live updates)

## Context

On the day a lead changes the hub from a phone: an update banner, a session's time, a link. Visitors already have the
hub open, many of them anonymous on a public event. Three things had to be settled: whether quick edits wait for a
publish, which endpoints carry them, and how an open hub learns that something changed.

## Decision

- **Quick edits change the hub at once.** Hub content is already live: a Published hub's page reads its sections on
  every request, with no published snapshot. Quick edits keep that rule and add no draft step.
- **The update banner has its own endpoints.** `PUT` and `DELETE /api/events/{id}/hub/update` set and clear
  `EventHub.UpdateBanner`, which the hub entity has carried since slice 41. It is up to 280 characters, trimmed, and
  null when cleared. The page DTO carries it as `updateBanner`.
- **Moving a session is a server command.** `POST /api/events/{id}/hub/agenda/move` takes `{ index, startsAt, shiftLater }`.
  The server computes the shift, so the rule "later rows move by the same amount" lives in Application and is tested
  with fixed times. "Later" means after the row in the agenda's order, which is the order the lead gave it. A Code
  freeze time that was a moved row's time moves with it, so the Links section never points at a time that no longer
  exists (`L2-160`).
- **Swapping a link reuses the section save.** The Links content already has an https rule and a code-freeze check,
  so the dialog saves `PUT /api/events/{id}/hub/sections/Links` with the other fields unchanged. Adding a second write
  path for the same content would add nothing.
- **Open hubs poll every 30 seconds instead of joining SignalR.** The only SignalR hub (`AgileHub`, ADR 0012) is for
  signed-in workspace members and its groups are checked per member. Hub visitors are often anonymous, and a public
  hub may have many viewers who need nothing more than "it changed". The page reads `GET /api/events/{id}/hub/page`
  every 30 seconds while the tab is visible, and once more when it becomes visible again. This costs one read per
  viewer per half minute, needs no new infrastructure, and works with the e2e fake as plain HTTP. A failed refresh
  keeps what the page shows.

## Consequences

- A change reaches open hubs within 30 seconds, not instantly. That is enough for "dinner moved to 6:30".
- No anonymous SignalR endpoint or connection management is added. A later slice can push changes over SignalR
  without changing the endpoints.
- Notifying RSVPs of a change stays deferred.
