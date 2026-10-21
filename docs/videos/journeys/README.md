# Journey videos

Narrated demo videos of every FaithTech Community user journey that works today. Each video is one
continuous take of the real Angular app at 1280x720, with on-screen captions, chapters, a WebVTT
caption file, a poster frame and the narration text it was spoken from.

> **The API is a local fake.** The app talks to the in-browser fake of the Community API and
> identity server that the e2e suite uses ([`e2e/fixtures/mock-api.ts`](../../../e2e/fixtures/mock-api.ts)).
> Every person, email address, password and token on screen is made up (`example.org`). Expired
> links, the server error and the lost connection are staged on purpose. Each video's opening card
> says the same.

## Videos

| Video | Length | What it shows | Rerun alone |
|---|---|---|---|
| [Sign up](sign-up.webm) · [poster](sign-up-poster.png) · [captions](sign-up.vtt) · [narration](sign-up-narration.md) | 1:10 | The Join FaithTech form, a too-short password caught before anything is sent, then a passphrase and the Check your inbox page. | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey sign-up` |
| [Verify email](verify-email.webm) · [poster](verify-email-poster.png) · [captions](verify-email.vtt) · [narration](verify-email-narration.md) | 1:12 | The pending page and resending the link, opening a valid link (You're in), then an expired link and asking for a new one. | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey verify-email` |
| [Sign in and sign out](sign-in-and-sign-out.webm) · [poster](sign-in-and-sign-out-poster.png) · [captions](sign-in-and-sign-out.vtt) · [narration](sign-in-and-sign-out-narration.md) | 1:23 | Redirect to sign in from a member page, empty-field and wrong-password errors, sign in with PKCE, sign out, and the session staying gone. | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey sign-in-and-sign-out` |
| [Forgot and reset password](password-reset.webm) · [poster](password-reset-poster.png) · [captions](password-reset.vtt) · [narration](password-reset-narration.md) | 1:26 | Forgot your password from sign in, a mistyped address, the neutral confirmation, a short and mismatched new password, saving it, and an expired link. | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey password-reset` |
| [App shell tour](app-shell-tour.webm) · [poster](app-shell-tour-poster.png) · [captions](app-shell-tour.vtt) · [narration](app-shell-tour-narration.md) | 1:36 | The top bar on desktop and tablet, the tab bar and menu drawer on a phone (focus trap and Escape), dark and light themes, and the skip link and focus rings. | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey app-shell-tour` |
| [Error and system pages](error-and-system-pages.webm) · [poster](error-and-system-pages-poster.png) · [captions](error-and-system-pages.vtt) · [narration](error-and-system-pages-narration.md) | 1:01 | Page not found, no access, a server error with its reference code, and the offline banner appearing and clearing. | `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey error-and-system-pages` |

All six are WebM files with a VP9 video stream (1280x720, 25 fps) and an Opus audio stream (48 kHz
mono, 48 kb/s, loudness-normalized), each 3-5 MB. The phone and tablet scenes in the app shell tour
use a 390 or 768 pixel wide viewport, so the rest of the frame is grey.

### Chapters

Chapters are embedded in each WebM and listed here.

| Video | Chapters |
|---|---|
| Sign up | 0:00 Opening · 0:14 The sign-up form · 0:23 A password that is too short · 0:33 Choose a passphrase · 0:42 Check your inbox · 0:50 Summary |
| Verify email | 0:00 Opening · 0:13 Waiting for the link · 0:20 Send another link · 0:27 Open the link · 0:35 An old link · 0:45 Ask for a new one · 0:54 Summary |
| Sign in and sign out | 0:00 Opening · 0:10 Members only · 0:20 Empty fields · 0:27 A wrong password · 0:36 Sign in · 0:46 Signed in · 0:54 Sign out · 1:00 Stays signed out · 1:06 Summary |
| Forgot and reset password | 0:00 Opening · 0:09 Forgot your password · 0:17 A mistyped address · 0:24 Request the link · 0:35 Open the reset link · 0:40 Two things to fix · 0:49 Save the new password · 0:58 An expired link · 1:08 Summary |
| App shell tour | 0:00 Opening · 0:15 Desktop · 0:31 Tablet · 0:36 Phone · 0:43 The menu · 0:53 Dark theme · 1:02 Light theme · 1:05 Keyboard · 1:16 Summary |
| Error and system pages | 0:00 Opening · 0:10 Page not found · 0:17 No access · 0:25 Server error · 0:35 Offline · 0:40 Back online · 0:45 Summary |

## Voice

One narrator for every video: `en-US-AndrewMultilingualNeural`, synthesized with the free
[`edge-tts`](https://github.com/rany2/edge-tts) package (no key or subscription). Set `EDGE_VOICE`
to try another voice. [`pronunciations.json`](pronunciations.json) maps written words to how they
are spoken (for example FaithTech, PKCE and WCAG); captions keep the written form.

## Regenerate

From the repository root, on Windows, macOS or Linux:

```sh
python -m pip install edge-tts           # once; use the interpreter named by PYTHON
pwsh eng/videos/Record-JourneyVideos.ps1  # all six videos
pwsh eng/videos/Record-JourneyVideos.ps1 -Journey sign-up,password-reset   # some of them
```

Prerequisites: PowerShell 7.2+, Node.js and npm (the script runs `npm ci` in `frontend/` and `e2e/`
if needed), Playwright's Chromium (`npm --prefix e2e run install:browser`), Python 3 with `edge-tts`
and internet access for synthesis, and ffmpeg/ffprobe built with libopus and libvpx.

What the script does, per journey:

1. Reads `<slug>-narration.md`, applies the pronunciations and synthesizes one clip per paragraph
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

These are the journeys implemented as of October 2026 (identity and platform). Profiles, invites,
contacts, partners, team, events, search, notifications, announcements, admin and the agile
workspace are not built yet ([estimates](../../estimates/README.md)), so they are not filmed; the
app shell tour shows their navigation entries only. The home page is still a placeholder.

Design decisions are recorded in [ADR 0001](../../adr/0001-journey-demo-videos.md). Sources:
[sign up](../../detailed-designs/identity/sign-up/),
[email verification](../../detailed-designs/identity/email-verification/),
[sign in and sign out](../../detailed-designs/identity/sign-in-and-sign-out/),
[password reset](../../detailed-designs/identity/password-reset/),
[responsive layout and theming](../../detailed-designs/platform/responsive-layout-and-theming/),
[error and system pages](../../detailed-designs/platform/error-and-system-pages/).
