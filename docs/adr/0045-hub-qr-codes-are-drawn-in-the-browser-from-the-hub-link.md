# 0045. Hub QR codes are drawn in the browser from the hub's link

- Status: Accepted
- Date: 2026-11-02
- Requirements: L1-008, L2-193 to L2-195
- Designs: `docs/detailed-designs/events/share-hub-by-qr-code`
- Proposal: `docs/proposals/event-hubs.md` (phase 3, "QR share")
- Refines: ADR 0021 (connect links, the first QR code), ADR 0039 (preview and publish)

## Context

A lead wants to put the hub in front of a room: on the projector before the talks, and on a printed sign at the
welcome table. The hub already has a link on its organisation's host (`EventHubDto.link`, `L2-165`), and the
`components` library already draws QR codes (`ft-qr-code`, from the connect link). Four things had to be settled:
where the code is made, what it encodes, how "full screen" works, and what a download produces.

## Decision

- **The browser draws the code from the hub's link.** `ShareHubDialog` passes `EventHubDto.link` to `ft-qr-code`,
  which encodes it itself (error correction M), exactly as `MyQrCodeDialog` does for a connect link. No endpoint,
  DTO field or table is added, and nothing is stored. The link already sits on the organisation's own host, so the
  code opens the hub in the right organisation (ADR 0032).
- **The code is the link.** It carries no token, tracking or short link. Who can open it is whoever can open the
  link (`L2-166`): anyone for a Published hub of a public event, signed-in members for a members-only event, and
  only holders of `ManageEventHubs` (as the preview) for a Draft. A Draft hub's Share dialog and full-screen view
  say so, rather than refusing to show the code: a lead may well want to test the code before publishing.
- **Full screen is a full-viewport CDK dialog plus the browser's full screen.** `DialogService.open` gains
  `{ fullScreen: true }`, and the new `ft-qr-presenter` component fills it. On opening it asks for
  `document.documentElement.requestFullscreen()`; a browser that refuses (or has no full-screen API) still shows the
  full-viewport view. Esc and Close full screen close it and leave the browser's full screen. Leaving the browser's
  full screen by itself (its own Esc, which the page may never see) closes the view, so one Esc is always enough
  and focus returns to Show full screen. A routed page was rejected: it would add a route outside the hub home for
  something that lasts a few minutes and would lose the dialog's focus return.
- **Download is a PNG only.** `ft-qr-code.downloadPng(fileName)` already draws the code on a canvas at about
  1024 px with its quiet zone, in the plate and module colours. SVG is not offered: the component has no SVG
  export, and a PNG of that size prints sharply on a letter or A4 sign. The file is named after the event:
  `{event-title-slug}-hub-qr-code.png`.

## Consequences

- No backend change: the existing 403 (no `ManageEventHubs`), 404 (another organisation) and page visibility tests
  cover who can see the link and who can open it. The e2e fake needs no new route.
- `ft-qr-code` gains a `fill` size and `DialogService` a `fullScreen` option, both reusable (a connect link could be
  shown full screen later).
- Printed posters, short links and an SVG download are deferred. Changing the hub's link (a new host, say) changes
  the code; printed codes are only as stable as the link.
