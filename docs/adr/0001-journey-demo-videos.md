# 0001. Journey demo videos

- Status: Accepted
- Date: 2026-10-21

## Context

We want one narrated demo video per user journey that works today, kept in
`docs/videos/journeys/`, and reproducible from a clean checkout with one command. The repository
had no video tooling, no `docs/videos/` folder and no PowerShell scripts in `eng/`. The e2e suite
already drives every implemented screen through page objects (`e2e/pages/`) against an in-browser
fake of the API (`e2e/fixtures/mock-api.ts`); there is no backend that a browser demo could run
against without a database and identity server.

## Decision

- **Layout.** Videos, posters, captions and narration text live in `docs/videos/journeys/`. The
  recording tooling lives in `eng/videos/`. Both folders are added to the layout tree in
  `AGENTS.md`.
- **Driver.** Each journey is a Playwright "story" (`eng/videos/journeys/<slug>.story.ts`) run by
  its own config (`eng/videos/playwright.config.ts`): Chromium only, one worker, no retries,
  1280x720 video always on, its own dev server port (4310). Stories reuse the e2e fixture and page
  objects; any new selector goes into a page object (for example `SignInPage.forgotPassword`).
  Stories assert what the narration claims before moving on, but they are recordings, not tests:
  the e2e config only collects `e2e/tests/`, and no CI job runs the stories.
- **Fake API.** Recordings use the same in-browser fake API as the e2e suite, with synthetic people
  (`example.org` addresses) and fake tokens. Every opening card and the index README say so. Staged
  failures (expired links, a server error) use the fake's per-endpoint overrides, exactly as the
  acceptance tests do.
- **Narration.** One `<slug>-narration.md` per journey: `## step-id: Chapter title` followed by one
  paragraph. The same text is the on-screen caption, the WebVTT caption and the source of the voice
  track. `pronunciations.json` holds spoken replacements. Voice: `en-US-AndrewMultilingualNeural`
  via the free `edge-tts` package (`EDGE_VOICE` overrides it). No second voice is used.
- **Timing.** Clips are synthesized and measured before recording. The presenter
  (`eng/videos/presenter.ts`) shows each caption, runs the step's actions, holds for the clip
  length plus 0.7 s and logs the caption time. The caption-to-video offset is measured from the
  first frame of the dark opening card.
- **Media.** Playwright's VP9 WebM is kept as is; the Opus narration track (48 kb/s mono,
  loudness-normalized), chapters and title are muxed in with `-c copy`. Posters are frames
  extracted from the final video. Temporary files go to the ignored `eng/videos/.run/`.
- **Entry point.** `pwsh eng/videos/Record-JourneyVideos.ps1` records all journeys;
  `-Journey <slug>[,<slug>]` reruns some. It verifies streams, size, chapters and that every
  paragraph is audible before copying anything into `docs/videos/journeys/`.

## Consequences

- Videos show the real Angular app, but not the real backend. When the API can run locally with
  seeded data, the stories can switch to it by dropping the fake and seeding accounts instead.
- Binary files (about 2-5 MB each) are committed directly; the repository has no Git LFS.
- Narration, captions and chapters change by editing text and rerunning one command. A journey
  whose screens change must be re-recorded; a failing story means the journey no longer works as
  narrated.
- Features at 0% in `docs/estimates/` are not filmed. The app shell tour shows their navigation
  entries only and says that those pages are still being built.
