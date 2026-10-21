# Validation record

Validated on 2026-09-07 on Windows using Python 3.12, Node.js, and an existing
Playwright 1.63.0 installation with Chromium. Sample applications and generated
media were kept in a disposable project outside the toolkit. No personal skill
installation or plugin publication was performed.

## Package checks

- Skill Creator's `quick_validate.py` passed.
- Codex `validate_plugin.py` and both Claude manifest validators passed. Claude
  reported the expected warning that root `CLAUDE.md` is not plugin context.
- The existing installer suite passed all eight tests, including copying complete
  skill folders to an isolated destination and preserving differing installations.
- UI metadata, evaluation JSON, relative Markdown links, matching `0.2.0` plugin
  versions, and whitespace were checked.

## Executed sample

The sample contained a browser reading-list app and an independent CLI sharing a
JSON data file, with no specifications or detailed designs. The web workflow saved
a title and verified it after reload; the CLI ran as a child process during capture
and returned the same persisted record. Its stdout/stderr appeared in a disclosed
browser display. Assertions checked persistence, output, and exit status.

Two complete runs produced separate captioned 1280 × 720 WebM files. The final
sample recordings measured 15.68 and 16.36 seconds; these intentionally short
fixtures exercised capture mechanics rather than full product-demo coverage.
Both videos were decoded and played through at normal speed, sampled frames were
visually inspected, and posters were extracted from the decoded footage. The
sample produced a demo index with metadata, chapters, source links, and rerun
instructions.

Injected outcome-assertion and startup failures returned errors and preserved
hashes of the existing video/poster/README set. An injected mid-promotion failure
restored the complete previous set. An unrelated listener and sentinel data
survived both failed runs, and owned recorded-application processes were stopped.

## Changes since this record

The narration requirement (synthesized edge-tts voice track using the
creating-narrated-videos voices, muxed into the WebM) was added after this validation. The
sample recordings described above were silent; narration synthesis, clip
timing, and the audio mux have not been exercised in a sample project yet.

## Coverage limits

This was an author-driven operational exercise, not an independent agent
evaluation. It exercised the principal browser/CLI path and selected failure
mechanics from [the scenarios](evals.json); it does not establish that every
scenario passed. API and worker recordings, native desktop and interactive PTY
capture, four-app discovery, and unavailable-capture behavior were reviewed as
instructions and scenario definitions but were not executed live. Plugin
marketplace-add/install flows were not rerun; packaging validators and the
isolated standalone installer suite were used.
