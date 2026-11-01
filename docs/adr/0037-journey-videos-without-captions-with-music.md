# 0037. Event hub journey videos: Kokoro voice, no captions, a ducked music bed

- Status: Accepted
- Date: 2026-11-01
- Requirements: none (tooling)
- Designs: `docs/detailed-designs/events/create-event-hub`
- Refines: ADR 0001 (journey demo videos), ADR 0020 (brochure video)

## Context

The event hub journeys (41 to 50) are recorded to sit beside the event-hubs proposal video, which the owner liked: the Kokoro
`af_heart` voice, a soca music bed under the narration and no captions. Every earlier journey uses edge-tts with captions and no
music, and must keep recording exactly as before.

## Decision

- `eng/videos/Record-JourneyVideos.ps1` gains three options, all off by default:
  - `-Engine kokoro` speaks the narration with Kokoro-82M ONNX (`onnx-community/Kokoro-82M-v1.0-ONNX`, Apache-2.0), voice `af_heart`
    at speed 1.0 (`KOKORO_VOICE`, `KOKORO_SPEED`), locally through `kokoro-onnx`, from the Hugging Face cache or `KOKORO_MODEL_DIR`.
    The default stays edge-tts.
  - `-NoCaptions` sets `DEMO_NO_CAPTIONS=1`, so `eng/videos/presenter.ts` draws no caption (the opening and closing cards stay), and
    writes no `captions.vtt` (removing an older one from the journey folder). Chapters stay in the WebM; `narration.md` is the transcript.
  - `-Music` mixes the bed under the narration: looped at a fixed gain of 0.22, faded in over 2 s and out over the last 3 s, ducked
    further by a sidechain compressor keyed from the voice (threshold 0.02, ratio 6, attack 20 ms, release 400 ms), limited and cut
    to the video's length.
- **The bed** is "Port of Spain Carnival Flow" from Pixabay (`https://cdn.pixabay.com/audio/2025/04/21/audio_226353a520.mp3`,
  overridable with `DEMO_MUSIC_URL`). The Pixabay Content License allows it inside a video without attribution but not redistributed
  on its own, so the recorder downloads it into the ignored `eng/videos/.run/music/` at record time and the repository never holds the
  track itself, only videos that contain it.
- **Audibility** is checked on both the mixed video and the narration track alone, for every paragraph, so music can never pass for a
  voice.

Rejected: an ffmpeg-generated tone bed (the owner chose the soca track); committing the mp3 (not allowed by its licence); captions with
music (the owner asked for none on these videos).

## Consequences

- Event hub journeys are rerun with `pwsh eng/videos/Record-JourneyVideos.ps1 -Journey <slug> -Engine kokoro -NoCaptions -Music`,
  which needs `pip install kokoro-onnx soundfile`, the cached model and network access for the first download of the bed.
- Existing journeys record unchanged; their edge-tts clip cache keys are unchanged.
- If the Pixabay URL disappears, `DEMO_MUSIC_URL` points the recorder at another track under a licence that allows use in video.
