# Terminal, API, worker, and native recording

Use when the application has no browser UI. Inspect existing automation and
available capture tools before choosing a method; do not assume a desktop,
interactive terminal, FFmpeg, or an OS-specific recorder exists.

## CLI applications

Capture a real terminal session using available platform tools. For noninteractive
CLIs, a local browser terminal display may instead stream commands and actual
stdout/stderr from child processes and be recorded with Playwright. Disclose that
presentation method. It must execute the commands during capture, preserve output
ordering, and show failures; do not animate prerecorded or invented responses.
Render output as text, not HTML. A pipes-based display is not a substitute for a
PTY when demonstrating an interactive TUI, prompts, cursor motion, or terminal
behavior; use an actual terminal or PTY-backed emulator for those applications.

Use a clean working directory, readable monospace text, bounded line lengths,
and synthetic input files. Show the actual command and its relevant result with
enough reading time. Assert exit codes and outputs or generated artifacts before
claiming success. If showing an expected validation failure, assert its expected
nonzero status and diagnostic, then demonstrate recovery where useful.

Launch known executables with explicit argument arrays rather than building shell
strings from data. Keep credentials out of displayed commands and output. A local
browser display must not expose a general command-execution endpoint: keep command
selection in the harness, bind locally, and display only the intended subprocess
stream. Bound process runtimes and clean up children started by the harness.

For browser-based capture and playback, read the configuration and finalization
guidance in [browser recording](browser-recording.md).

## APIs and workers

An independently runnable first-party API needs its own focused recording, even
when a frontend video also exercises it. Use a terminal HTTP client or an existing
API explorer to show meaningful requests against the real local service. Show
status and relevant response fields, assert the contract, and verify persistence
or another observable effect where applicable. Health checks alone rarely explain
an application's purpose. Avoid showing authentication tokens on screen.

For a worker, record the real job submission, processing, and externally observable
result: a changed record, generated file, delivered local message, or queried job
status. Correlate the result to the submitted job. Wait with a finite deadline
and assert completion rather than narrating success from a startup log. Label any
development integration adapter. A worker with no usable local trigger or way to
observe its result is blocked; do not replace it with a simulated progress screen.

## Native applications

Use the application's actual window with compatible OS automation and capture.
Verify the recorder can capture that surface before building a long walkthrough;
headless or locked desktop sessions may not support it. Record only the required
window or region, with notifications and unrelated windows out of view.

Drive real controls with available accessibility/automation APIs and assert visible
state or resulting artifacts. Use a separate caption overlay or recorder-supported
text when available without modifying product code or intercepting its input.
Do not silently replace a native UI with a browser mockup. If automation, desktop
access, readable captioning, or WebM encoding is unavailable, state the specific
missing capability and complete other applications.

## Continuous footage and deliverables

The final WebM must preserve the actual sequence and timing of the successful take.
Encoding a captured terminal stream or transcoding continuous native footage is
acceptable; disclose the method and retain its reproducible source. Do not splice
unrelated runs, remove a failed step, or insert fabricated application output.
Use title cards and captions with the same readability goals as browser demos.
Narrate the take the same way: synthesize the paragraphs with edge-tts before
capture, hold each caption for at least its clip's duration, log when it
appeared, and mux the assembled Opus track into the finished WebM afterward.

Check recorder and encoder exit status, finalize files, inspect decoded playback,
measure media properties, verify chapter times, and extract a representative
poster. Keep the previous deliverables until the replacement passes all checks.
Missing capture, narration, or encoding tools are actionable blockers, not
grounds to deliver a silent video, a transcript, a screenshot slideshow, or an
empty video as a completed demo.
