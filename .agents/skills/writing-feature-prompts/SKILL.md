---
name: writing-feature-prompts
description: Write a ready-to-run implementation prompt for a feature request or a bug fix in the current repository, save it outside the repository and open it in a text editor (Notepad on Windows). A feature prompt drives mocks, design system, requirements, detailed design, estimate update and incremental acceptance-test-driven implementation end to end without stopping; a bug-fix prompt drives reproduce, root cause, fix and documentation alignment. Use whenever the user asks to "create a prompt", "write a prompt for this feature" or "for this bug", wants a "prompt to build X" or "prompt to fix Y", or asks to open a prompt in Notepad.
---

# Writing feature prompts

Turn a feature request or a bug report into one prompt that another agent can run from start to finish. The
prompt directs the work. Do not design or implement the solution here.

## Steps

1. **Gather context (read-only, quick).** Read the project's `AGENTS.md` (or `CLAUDE.md`). Then search for
   what the request touches: screens and components, backend files, existing requirements (for example
   `docs/specs/L2.md` and its next free number), mocks in `docs/mocks/`, the design system, and the matching
   `docs/detailed-designs/{subsystem}/` folder. Note which of the phase artefacts the project actually has,
   and which skills are installed.
2. **Choose the template:** Feature or Bug fix (below). If the request is ambiguous, pick the closest and say
   so in the reply. Do not stop to ask.
3. **Fit the template to the project.** Keep a phase only if the project uses that artefact. Name the skill
   that serves each phase, if one is installed. Bring in the project's own binding rules from `AGENTS.md`,
   such as component-library rules, test frameworks, browsers, runtime versions and branch policy, without
   inventing new ones.
4. **Write the prompt** to `<scratch>/<kebab-slug>-prompt.md`. Use the session's scratchpad directory if there
   is one, otherwise the OS temp directory. Never write it into the repository.
5. **Open it:**
   - Windows: `Start-Process notepad "<path>"` (PowerShell) or `notepad.exe "<path>" &` (Bash).
   - macOS: `open -t "<path>"`.
   - Linux: `xdg-open "<path>"`.

   If no editor can be opened, say so and give the path.
6. **Reply** with the prompt's full absolute path and a brief summary of what it covers.

## Writing rules

- Fill in real paths, component names and requirement numbers from step 1. Leave no `<placeholders>` in the
  finished prompt.
- Keep to what the user asked for. Put anything nearby under "deferred", not into the scope.
- List states and slices as suggestions the implementer can adjust.
- Write in plain, short sentences.

## Shared sections (use in both templates)

```markdown
## Finish the whole <feature|fix> in one run. Do not stop. (CRITICAL)

- You are authorised to take this <feature|fix> all the way: <the phases>, green tests and a pull request.
  Go through every phase and every slice in one continuous run. Do not pause between phases to report, ask
  for approval, or wait for "continue".
- Do not end your turn until the "Done means" list at the bottom is fully true. A partial result, a plan, or
  "the next steps would be..." is not done.
- Where `AGENTS.md` says "stop and ask", treat this prompt as the confirmation in advance for everything in
  scope here. Choose the simplest option that fits the existing architecture, record it (an architecture
  decision record or the detailed design's open-questions section), and keep going.
- If a shared component library lacks something, that is not a reason to stop. Update the design and the
  library first, as the project rules require, then go on.
- When a test, build or command fails, find the root cause and fix it, then go on. Never weaken a test to make
  it pass, and never skip a step quietly.
- Only stop for a real blocker you cannot resolve yourself, such as missing credentials, or an action outside
  this repository that can't be undone, such as production deploys or data changes. If that happens, finish
  everything else first, then report the blocker clearly.
- Keep track of progress (a todo list), so that nothing gets left out after context is summarised.

## Rules (read first, binding)

- Follow `AGENTS.md` exactly, especially: <the project's binding rules from step 3, e.g. scope lock,
  mandatory component library, test framework and page objects, browsers, file layout>.
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Work through the phases below **in order**, using the skill each phase names.
- Copy the house style of each folder. Read the existing neighbours before you write anything new.
```

## Feature template

```markdown
# Feature: <title>

## Goal

<What the user sees and can do, who can do it, where it appears today (real files), and what stays
unchanged.>

<Shared sections>

## Phase 1: Mocks (`writing-html-mocks`)
- Update or add mocks in `docs/mocks/` for every state, light and dark, at phone, tablet and desktop widths:
  <the screens and states: default, empty, busy, success, invalid, failed...>.
- Update the mock manifest, gallery and coverage matrix.

## Phase 2: Design system (`extracting-design-systems`)
- Update `docs/design-system/` for <the components that change or are new>. Change tokens only if this needs
  new values.
- Update `docs/screen-composition.md` (`writing-screen-composition`) for every screen that changed.

## Phase 3: Requirements (`writing-requirements`)
- Add L1 entries if needed, and new L2 requirements (next free number after <L2-nnn>) with Given/When/Then
  acceptance criteria covering: <the behaviours, the validation, and the security and privacy concerns>.
- Cross-reference the requirements that already exist (<list>) instead of copying them.

## Phase 4: Detailed design (`writing-design-documents`)
- Add `docs/detailed-designs/<subsystem>/<feature>/` in the house style. Cover <the backend, data, frontend
  and key decisions>. Record real decisions in an architecture decision record.
- Update the existing designs this touches (<list>) only where needed.

## Phase 5: Estimate update (`estimating-designs`)
- Add the design to `docs/estimates/` at 0%, and update it again when the work is done.

## Phase 6: Incremental implementation (ATDD)
- Plan thin vertical slices, for example:
  1. <slice>
  2. <slice>
- For each slice:
  - Write the Given-When-Then criteria.
  - Write the acceptance test, traced to its requirement.
  - Run it and show that it fails for the expected reason.
  - Implement the minimum that makes it pass, and refactor while the tests are green.
  - Run the regression checks, then commit.
- When all slices are green, update the estimate to its true percent complete and keep the mocks, design
  system, screen composition and designs aligned with what was built.

## Done means
- <The behaviour, stated end to end.>
- All the new and existing tests pass.
- The documentation agrees with the code.
- The work is on a branch with a pull request to the default branch, and its checks are green. Fetch and
  rebase first.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and
  anything deferred.
```

## Bug-fix template

```markdown
# Bug fix: <title>

## Bug

<What happens, what should happen, how to reproduce it, and where it lives (real files). The requirement it
breaks, if any: <L2-nnn>.>

<Shared sections>

## Phase 1: Reproduce
- Write a failing test that shows the bug, at the level where it is visible (acceptance, API or unit), traced
  to its requirement. Run it and show that it fails for the bug's reason.

## Phase 2: Root cause
- Find and state the cause, not the symptom. Check for the same cause elsewhere.

## Phase 3: Fix
- Make the smallest change that turns the test green. Refactor while it is green, run the regression checks,
  then commit.

## Phase 4: Align the docs (only if the behaviour or the spec was wrong or silent)
- Update the requirements, the detailed design, the mocks or the screen composition to match.
- Update the estimates only if a design's percent complete changes.

## Done means
- The bug is gone, and the new test proves it.
- All the existing tests pass.
- The work is on a branch with a pull request to the default branch, and its checks are green. Fetch and
  rebase first.
- Only then end the run, with a short summary of the cause, the fix and anything deferred.
```
