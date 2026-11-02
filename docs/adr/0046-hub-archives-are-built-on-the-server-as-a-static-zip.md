# 0046. Hub archives are built on the server as a static zip

- Status: Accepted
- Date: 2026-11-02
- Requirements: L1-008, L2-196 to L2-198
- Designs: `docs/detailed-designs/events/download-hub-archive`
- Proposal: `docs/proposals/event-hubs.md` (phase 3, "Download as an archive, for the record")
- Refines: ADR 0036 (hubs read their facts live), ADR 0040 (who may see a hub page), ADR 0042 (hub files come from Resources)

## Context

A chapter wants to keep its hub after the event: the agenda, the tracks, the judging criteria, the slides and the
parking maps, as `docs/events/socal-hackathon-2026/` keeps the SoCal hackathon. The hub itself is live data: its
facts come from the event, People from Profiles, Partners from Partners, and its maps and slides from Resources
(ADR 0036, ADR 0042). Five things had to be settled: where the copy is made, what it contains, what it looks like
without the app, which time zone its times are in, and who may take it.

## Decision

- **The server builds the zip.** `GET /api/events/{id}/hub/archive` (`HubArchiveHandler` in Application) reads the
  hub exactly as the hub page answers visitors (`GetEventHubHandler.PageAsync`), so a hidden or unfinished section,
  an archived resource or a deleted profile is left out by the same rules (`L2-163`, `L2-173`, `L2-182`). It reads
  each map, slide and photo from blob storage and hands everything to `IHubArchiveWriter`, implemented in
  Infrastructure (`HubArchiveWriter`), which writes the page and the zip. Building it in the browser was rejected:
  the browser would need one request per file, and the section rules would be repeated in TypeScript.
- **One folder, one static page.** The zip holds "{slug}-hub/" with `index.html`, `images/` (maps and photos) and
  `slides/`, numbered in hub order with the stored file's extension. The page has no script, no web font and no
  external stylesheet: the agenda is a plain list with no live state, slides are a grid of images linked to their
  files, a PDF slide is a link. Outbound links (RSVP is left out; maps, track briefs, forms, giving, the live hub)
  need a connection and the saved note says so.
- **Styles are the design tokens by value.** One inline `<style>` declares the token roles the page reads with their
  light values, and their dark values under `prefers-color-scheme: dark`, so the copy follows the reader's theme.
  The rules read roles, never hex values (`patterns/event-hub-sections.html#saved-copy`).
- **Times are in the downloader's time zone.** The platform stores instants and has no organisation or event time
  zone; the app shows times in the browser's zone. The hub home sends `Intl.DateTimeFormat().resolvedOptions().timeZone`
  as `timeZone`; the server converts with `TimeZoneInfo` and names the zone in the saved note. No zone gives UTC; an
  unknown zone is a 400.
- **Only hub managers, audited.** The endpoint needs `ManageEventHubs` (403 otherwise, 401 anonymous) and works on
  a Draft or a Published hub. An event of another organisation is 404, and every resource and photo is found through
  the organisation's query filter, so no other organisation's blob is read (ADR 0032). Each download is audited as
  `event_hub.archived`, with `Override` when only `AdministerOrganisation` allowed it.

## Consequences

- No migration and nothing stored; the zip is built in memory per request. Hubs hold a lead's chosen slides and
  maps, each within Resources' upload limit, so memory is bounded in practice; streaming can come later.
- The page's markup mirrors the hub page's displays by hand. A new section kind needs a display in the app and a
  renderer in `HubArchiveWriter`; its tests list every kind.
- Whoever holds the zip can read it, like any saved copy. People in it are shown by name, line and photo, as on the
  public hub page, without profile ids.
- Scheduled archives and archiving into Resources are deferred.
