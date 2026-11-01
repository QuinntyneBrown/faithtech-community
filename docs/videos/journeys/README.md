# Journey videos

Narrated demo videos of every FaithTech Community user journey that has a screen. Each journey has its
own folder holding `video.webm`, `poster.png`, `captions.vtt` and `narration.md`. A video is one
continuous take of the real Angular app at 1280x720, with on-screen captions, embedded chapters, a
WebVTT caption file, a poster frame and the narration text it was spoken from.

> **The API is a local fake.** The app talks to the in-browser fake of the Community API and
> identity server that the e2e suite uses ([`e2e/fixtures/mock-api.ts`](../../../e2e/fixtures/mock-api.ts)).
> Every person, email address, password and token on screen is made up (`example.org`). Expired
> links, the server error and the lost connection are staged on purpose. Profile pictures are
> illustrations drawn in the browser ([`eng/videos/photos.ts`](../../../eng/videos/photos.ts)). Each
> video's opening card says the same.

## Videos

### Identity

| Video | Length | Rerun alone |
|---|---|---|
| [Sign up](sign-up/video.webm) · [poster](sign-up/poster.png) · [captions](sign-up/captions.vtt) · [narration](sign-up/narration.md) | 1:10 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey sign-up` |
| [Verify email](verify-email/video.webm) · [poster](verify-email/poster.png) · [captions](verify-email/captions.vtt) · [narration](verify-email/narration.md) | 1:12 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey verify-email` |
| [Sign in and sign out](sign-in-and-sign-out/video.webm) · [poster](sign-in-and-sign-out/poster.png) · [captions](sign-in-and-sign-out/captions.vtt) · [narration](sign-in-and-sign-out/narration.md) | 1:23 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey sign-in-and-sign-out` |
| [Forgot and reset password](password-reset/video.webm) · [poster](password-reset/poster.png) · [captions](password-reset/captions.vtt) · [narration](password-reset/narration.md) | 1:25 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey password-reset` |

### Platform

| Video | Length | Rerun alone |
|---|---|---|
| [App shell tour](app-shell-tour/video.webm) · [poster](app-shell-tour/poster.png) · [captions](app-shell-tour/captions.vtt) · [narration](app-shell-tour/narration.md) | 1:36 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey app-shell-tour` |
| [Error and system pages](error-and-system-pages/video.webm) · [poster](error-and-system-pages/poster.png) · [captions](error-and-system-pages/captions.vtt) · [narration](error-and-system-pages/narration.md) | 1:00 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey error-and-system-pages` |
| [Your home page](home/video.webm) · [poster](home/poster.png) · [captions](home/captions.vtt) · [narration](home/narration.md) | 1:20 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey home` |

### Profiles

| Video | Length | Rerun alone |
|---|---|---|
| [View profiles](view-profile/video.webm) · [poster](view-profile/poster.png) · [captions](view-profile/captions.vtt) · [narration](view-profile/narration.md) | 1:08 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey view-profile` |
| [Edit your profile](edit-own-profile/video.webm) · [poster](edit-own-profile/poster.png) · [captions](edit-own-profile/captions.vtt) · [narration](edit-own-profile/narration.md) | 0:54 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey edit-own-profile` |
| [Manage profile photos](manage-profile-photos/video.webm) · [poster](manage-profile-photos/poster.png) · [captions](manage-profile-photos/captions.vtt) · [narration](manage-profile-photos/narration.md) | 1:19 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey manage-profile-photos` |
| [People and roles](people-directory/video.webm) · [poster](people-directory/poster.png) · [captions](people-directory/captions.vtt) · [narration](people-directory/narration.md) | 1:16 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey people-directory` |

### Invites

| Video | Length | Rerun alone |
|---|---|---|
| [Send an invite](send-invite/video.webm) · [poster](send-invite/poster.png) · [captions](send-invite/captions.vtt) · [narration](send-invite/narration.md) | 1:12 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey send-invite` |
| [Accept an invite](accept-invite/video.webm) · [poster](accept-invite/poster.png) · [captions](accept-invite/captions.vtt) · [narration](accept-invite/narration.md) | 1:12 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey accept-invite` |

### Contacts

| Video | Length | Rerun alone |
|---|---|---|
| [Manage contacts](manage-contacts/video.webm) · [poster](manage-contacts/poster.png) · [captions](manage-contacts/captions.vtt) · [narration](manage-contacts/narration.md) | 1:11 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey manage-contacts` |
| [Contact notes](contact-notes/video.webm) · [poster](contact-notes/poster.png) · [captions](contact-notes/captions.vtt) · [narration](contact-notes/narration.md) | 0:57 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey contact-notes` |
| [Archive, restore and delete contacts](archive-restore-delete-contacts/video.webm) · [poster](archive-restore-delete-contacts/poster.png) · [captions](archive-restore-delete-contacts/captions.vtt) · [narration](archive-restore-delete-contacts/narration.md) | 1:07 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey archive-restore-delete-contacts` |
| [Link a contact on sign-up](link-contact-on-sign-up/video.webm) · [poster](link-contact-on-sign-up/poster.png) · [captions](link-contact-on-sign-up/captions.vtt) · [narration](link-contact-on-sign-up/narration.md) | 1:09 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey link-contact-on-sign-up` |
| [A possible duplicate contact](possible-duplicate-contact/video.webm) · [poster](possible-duplicate-contact/poster.png) · [captions](possible-duplicate-contact/captions.vtt) · [narration](possible-duplicate-contact/narration.md) | 1:09 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey possible-duplicate-contact` |

### Partners

| Video | Length | Rerun alone |
|---|---|---|
| [Manage partners](manage-partners/video.webm) · [poster](manage-partners/poster.png) · [captions](manage-partners/captions.vtt) · [narration](manage-partners/narration.md) | 1:24 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey manage-partners` |
| [The partner board](partner-kanban-board/video.webm) · [poster](partner-kanban-board/poster.png) · [captions](partner-kanban-board/captions.vtt) · [narration](partner-kanban-board/narration.md) | 1:12 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey partner-kanban-board` |
| [The partner activity timeline](partner-activity-timeline/video.webm) · [poster](partner-activity-timeline/poster.png) · [captions](partner-activity-timeline/captions.vtt) · [narration](partner-activity-timeline/narration.md) | 1:27 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey partner-activity-timeline` |
| [Duplicate partners and merge](duplicate-detection-and-merge/video.webm) · [poster](duplicate-detection-and-merge/poster.png) · [captions](duplicate-detection-and-merge/captions.vtt) · [narration](duplicate-detection-and-merge/narration.md) | 1:55 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey duplicate-detection-and-merge` |

### Team

| Video | Length | Rerun alone |
|---|---|---|
| [The team](team-list/video.webm) · [poster](team-list/poster.png) · [captions](team-list/captions.vtt) · [narration](team-list/narration.md) | 1:10 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey team-list` |

### Events

| Video | Length | Rerun alone |
|---|---|---|
| [Create and edit events](create-and-edit-events/video.webm) · [poster](create-and-edit-events/poster.png) · [captions](create-and-edit-events/captions.vtt) · [narration](create-and-edit-events/narration.md) | 1:23 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey create-and-edit-events` |
| [Event list and filters](event-list-and-filter/video.webm) · [poster](event-list-and-filter/poster.png) · [captions](event-list-and-filter/captions.vtt) · [narration](event-list-and-filter/narration.md) | 1:13 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey event-list-and-filter` |
| [RSVP to an event](rsvp/video.webm) · [poster](rsvp/poster.png) · [captions](rsvp/captions.vtt) · [narration](rsvp/narration.md) | 1:09 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey rsvp` |
| [Cancel an event](cancel-events/video.webm) · [poster](cancel-events/poster.png) · [captions](cancel-events/captions.vtt) · [narration](cancel-events/narration.md) | 1:00 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey cancel-events` |
| [Public events and guest RSVP](public-events-and-guest-rsvp/video.webm) · [poster](public-events-and-guest-rsvp/poster.png) · [captions](public-events-and-guest-rsvp/captions.vtt) · [narration](public-events-and-guest-rsvp/narration.md) | 1:05 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey public-events-and-guest-rsvp` |
| [Add an event to your calendar](calendar-export/video.webm) · [poster](calendar-export/poster.png) · [captions](calendar-export/captions.vtt) · [narration](calendar-export/narration.md) | 0:54 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey calendar-export` |
| [Check in at the door](event-check-in/video.webm) · [poster](event-check-in/poster.png) · [captions](event-check-in/captions.vtt) · [narration](event-check-in/narration.md) | 1:35 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey event-check-in` |

### Search

| Video | Length | Rerun alone |
|---|---|---|
| [Search everything](global-search/video.webm) · [poster](global-search/poster.png) · [captions](global-search/captions.vtt) · [narration](global-search/narration.md) | 1:09 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey global-search` |

### Notifications

| Video | Length | Rerun alone |
|---|---|---|
| [In-app notifications](in-app-notifications/video.webm) · [poster](in-app-notifications/poster.png) · [captions](in-app-notifications/captions.vtt) · [narration](in-app-notifications/narration.md) | 1:03 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey in-app-notifications` |
| [Email notifications](email-notifications/video.webm) · [poster](email-notifications/poster.png) · [captions](email-notifications/captions.vtt) · [narration](email-notifications/narration.md) | 1:10 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey email-notifications` |

### Announcements

| Video | Length | Rerun alone |
|---|---|---|
| [Send an announcement](send-announcement/video.webm) · [poster](send-announcement/poster.png) · [captions](send-announcement/captions.vtt) · [narration](send-announcement/narration.md) | 1:07 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey send-announcement` |
| [Read announcements and opt out](read-announcements-and-opt-out/video.webm) · [poster](read-announcements-and-opt-out/poster.png) · [captions](read-announcements-and-opt-out/captions.vtt) · [narration](read-announcements-and-opt-out/narration.md) | 0:57 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey read-announcements-and-opt-out` |

### Docs & notes

| Video | Length | Rerun alone |
|---|---|---|
| [Docs & notes](docs-and-notes/video.webm) · [poster](docs-and-notes/poster.png) · [captions](docs-and-notes/captions.vtt) · [narration](docs-and-notes/narration.md) | 1:25 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey docs-and-notes` |

### Reports

| Video | Length | Rerun alone |
|---|---|---|
| [Reports](reports-dashboard/video.webm) · [poster](reports-dashboard/poster.png) · [captions](reports-dashboard/captions.vtt) · [narration](reports-dashboard/narration.md) | 1:40 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey reports-dashboard` |

### Admin

| Video | Length | Rerun alone |
|---|---|---|
| [Admin users and profile override](admin-users-and-override/video.webm) · [poster](admin-users-and-override/poster.png) · [captions](admin-users-and-override/captions.vtt) · [narration](admin-users-and-override/narration.md) | 1:11 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey admin-users-and-override` |
| [Assign roles](assign-roles/video.webm) · [poster](assign-roles/poster.png) · [captions](assign-roles/captions.vtt) · [narration](assign-roles/narration.md) | 1:09 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey assign-roles` |
| [Suspend and reinstate users](suspend-users/video.webm) · [poster](suspend-users/poster.png) · [captions](suspend-users/captions.vtt) · [narration](suspend-users/narration.md) | 1:02 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey suspend-users` |
| [The audit log](audit-log/video.webm) · [poster](audit-log/poster.png) · [captions](audit-log/captions.vtt) · [narration](audit-log/narration.md) | 0:56 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey audit-log` |

### Agile

| Video | Length | Rerun alone |
|---|---|---|
| [Workspaces and membership](workspaces-and-membership/video.webm) · [poster](workspaces-and-membership/poster.png) · [captions](workspaces-and-membership/captions.vtt) · [narration](workspaces-and-membership/narration.md) | 1:17 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey workspaces-and-membership` |
| [Work items](work-items/video.webm) · [poster](work-items/poster.png) · [captions](work-items/captions.vtt) · [narration](work-items/narration.md) | 1:09 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey work-items` |
| [The board](board/video.webm) · [poster](board/poster.png) · [captions](board/captions.vtt) · [narration](board/narration.md) | 1:04 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey board` |
| [Sprints](sprints/video.webm) · [poster](sprints/poster.png) · [captions](sprints/captions.vtt) · [narration](sprints/narration.md) | 1:10 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey sprints` |
| [Planning Poker](planning-poker/video.webm) · [poster](planning-poker/poster.png) · [captions](planning-poker/captions.vtt) · [narration](planning-poker/narration.md) | 1:19 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey planning-poker` |
| [Switch method](switch-method/video.webm) · [poster](switch-method/poster.png) · [captions](switch-method/captions.vtt) · [narration](switch-method/narration.md) | 1:05 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey switch-method` |
| [Archive and transfer workspaces](archive-and-transfer-workspaces/video.webm) · [poster](archive-and-transfer-workspaces/poster.png) · [captions](archive-and-transfer-workspaces/captions.vtt) · [narration](archive-and-transfer-workspaces/narration.md) | 1:19 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey archive-and-transfer-workspaces` |

### Event hubs

These journeys are narrated with the Kokoro `af_heart` voice over a quiet music bed, and have no captions: `narration.md` is
the transcript and the chapters are embedded in the WebM (ADR 0037).

| Video | Length | Rerun alone |
|---|---|---|
| [Create an event hub](create-event-hub/video.webm) · [poster](create-event-hub/poster.png) · [narration](create-event-hub/narration.md) | 1:28 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey create-event-hub -Engine kokoro -NoCaptions -Music` |
| [Fill in hub sections](fill-in-hub-sections/video.webm) · [poster](fill-in-hub-sections/poster.png) · [narration](fill-in-hub-sections/narration.md) | 1:53 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey fill-in-hub-sections -Engine kokoro -NoCaptions -Music` |
| [Preview and publish a hub](preview-and-publish-hub/video.webm) · [poster](preview-and-publish-hub/poster.png) · [narration](preview-and-publish-hub/narration.md) | 1:12 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey preview-and-publish-hub -Engine kokoro -NoCaptions -Music` |
| [Visit an event hub](visit-event-hub/video.webm) · [poster](visit-event-hub/poster.png) · [narration](visit-event-hub/narration.md) | 1:10 | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey visit-event-hub -Engine kokoro -NoCaptions -Music` |

All are WebM files with a VP9 video stream (1280x720, 25 fps) and an Opus audio stream (48 kHz
mono, 48 kb/s, loudness-normalized). The chapters are embedded in each WebM and listed in its
`captions.vtt`. The phone and tablet scenes in the app shell tour use a 390 or 768 pixel wide
viewport, so the rest of the frame is grey.

## Voice

One narrator for every video except the event hubs (Kokoro `af_heart`, ADR 0037): `en-US-AndrewMultilingualNeural`, synthesized with the free
[`edge-tts`](https://github.com/rany2/edge-tts) package (no key or subscription). Set `EDGE_VOICE`
to try another voice. [`pronunciations.json`](pronunciations.json) maps written words to how they
are spoken (for example FaithTech, PKCE and WCAG); captions keep the written form.

## Regenerate

From the repository root, on Windows, macOS or Linux:

```sh
python -m pip install edge-tts           # once; use the interpreter named by PYTHON
pwsh eng/videos/Record-JourneyVideos.ps1  # every video
pwsh eng/videos/Record-JourneyVideos.ps1 -Journey sign-up,password-reset   # some of them
pwsh eng/videos/Record-JourneyVideos.ps1 -Missing   # only journeys without a video yet
```

Prerequisites: PowerShell 7.2+, Node.js and npm (the script runs `npm ci` in `frontend/` and `e2e/`
if needed), Playwright's Chromium (`npm --prefix e2e run install:browser`), Python 3 with `edge-tts`
and internet access for synthesis, and ffmpeg/ffprobe built with libopus and libvpx.

What the script does, per journey:

1. Reads `<slug>/narration.md`, applies the pronunciations and synthesizes one clip per paragraph
   (cached by text and voice), measuring each clip.
2. Starts the Angular dev server on its own port (4310; `-Port` changes it) and records the
   story in [`eng/videos/journeys/`](../../../eng/videos/journeys/) with
   [`eng/videos/playwright.config.ts`](../../../eng/videos/playwright.config.ts): Chromium only, one
   worker, no retries. Each caption is held for its clip plus 0.7 seconds, and each step checks the
   screen shows what the narration says before moving on.
3. Lays each clip at its caption's time (the offset is measured from the opening card's first
   frame), loudness-normalizes the track and muxes it, the chapters and the title into the WebM
   with `-c copy`, so the video stream is never re-encoded. Writes the `.vtt` captions and extracts
   the poster frame from the finished video.
4. Checks one 1280x720 video stream, one Opus stream, the chapter count and that every paragraph
   is audible, and only then copies the files here. A failed journey leaves its earlier video in
   place.

Temporary clips, takes and Playwright output go to `eng/videos/.run/`, which git ignores. The
recordings are separate from the acceptance suite: `e2e/playwright.config.ts` never collects the
stories, and no CI job runs them.

Behind a TLS-intercepting proxy, `edge-tts` trusts only the `certifi` bundle; append the proxy's CA
to the file `python -c "import certifi; print(certifi.where())"` prints.

## Scope

One journey per detailed design that has a screen. Designs with no screen of their own (accessibility,
performance, server authorization, input validation and web protections, reliability and observability)
are not filmed; the app shell tour covers responsive layout and theming. A new journey is a
`eng/videos/journeys/<slug>.story.ts` plus `docs/videos/journeys/<slug>/narration.md`; the recorder
finds it by file name. Re-record a journey when its screens change.

Design decisions are recorded in [ADR 0001](../../adr/0001-journey-demo-videos.md). Each journey's
source design is `docs/detailed-designs/<subsystem>/<slug>/`.
