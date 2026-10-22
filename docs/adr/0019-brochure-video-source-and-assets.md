# 0019. Brochure video source and assets

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-056
- Designs: `docs/detailed-designs/marketing/landing-page`

## Context

The marketing page embeds a brochure video of 30 seconds or less with a poster, captions and visible controls. Journey videos (`docs/videos/journeys/`, ADR 0001) are recordings of the running app made by `eng/videos/`; the brochure is a marketing asset, not a journey, and must stay out of the acceptance run.

## Decision

- The source lives in `eng/videos/brochure/`: the narration script (`script.md`), a timed HTML slide deck (`deck.html`) that uses the design-system tokens and mock photos, and `build.mjs`, which renders the narration with edge-tts, captures the deck frame by frame with Playwright's Chromium, and muxes both with ffmpeg.
- The build writes the shipped assets to `frontend/projects/marketing/public/brochure/`: `brochure.mp4` (H.264 + AAC, 1280×720), `brochure-poster.jpg` and `brochure.en.vtt`. The build fails if the video is longer than 30 seconds.
- The video is self-hosted. No YouTube or Vimeo embed, so no third-party frames, cookies or trackers, and the page needs no `frame-src`.

## Consequences

- Re-run `node eng/videos/brochure/build.mjs` when the script or the deck changes, and commit the three assets.
- The brochure is not in `docs/videos/journeys/` and is not recorded by `Record-JourneyVideos.ps1`.
