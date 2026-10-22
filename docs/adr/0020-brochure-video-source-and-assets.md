# 0020. Brochure video source and assets

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-075
- Designs: `docs/detailed-designs/marketing/landing-page`

## Context

The marketing page embeds a brochure video of 30 seconds or less with a poster, captions and visible controls. Journey videos (`docs/videos/journeys/`, ADR 0001) are recordings of the running app made by `eng/videos/`; the brochure is a marketing asset, not a journey, and must stay out of the acceptance run.

## Decision

- The source lives in `eng/videos/brochure/`: the narration script (`script.md`, one `##` section per slide), an HTML slide deck (`deck.html`) that uses the design-system tokens and mock photos, and `build.mjs`, which renders the narration locally with Kokoro-82M from Hugging Face (`hexgrad/Kokoro-82M`, Apache-2.0, voice `af_heart`; or, with `--engine edge`, edge-tts, or with `--engine espeak`, the offline espeak-ng MBROLA `mb-us2` voice), captures each slide with Playwright's Chromium, holds it for its narration, and muxes both with ffmpeg.
- The build writes the shipped assets to `frontend/projects/marketing/public/brochure/`: `brochure.webm` (VP9 + Opus, 1280×720; WebM because Chromium builds without proprietary codecs, including Playwright's, cannot play H.264), `brochure-poster.jpg` and `brochure.en.vtt`. The build fails if the video is longer than 30 seconds.
- The video is self-hosted. No YouTube or Vimeo embed, so no third-party frames, cookies or trackers, and the page needs no `frame-src`.

## Consequences

- Re-run `node eng/videos/brochure/build.mjs` when the script or the deck changes, and commit the three assets.
- Kokoro needs Python 3.10+ with `pip install kokoro soundfile`; pass that interpreter as `PYTHON` (for example a venv in `.cache/kokoro-venv`). The model downloads once to the Hugging Face cache, then the build runs offline.
- The current render (21 seconds) uses Kokoro `af_heart` at speed 1.1 (`KOKORO_VOICE`, `KOKORO_SPEED`). It replaced the first render's robotic espeak voice. The captions and timings are regenerated from each new narration.
- The brochure is not in `docs/videos/journeys/` and is not recorded by `Record-JourneyVideos.ps1`.
