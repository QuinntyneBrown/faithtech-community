---
name: building-apps-end-to-end
description: One-shot build of a full stack app and all of its supporting documents, from a single idea - agent instructions, HTML mocks, design system, L1/L2 specs, detailed designs, estimates, then an incremental acceptance-test-driven implementation - using the 14-step workflow from the "Full stack with Claude" series. It asks the user for everything it needs in a plan stage (idea, stack, features, look and feel, name, repo, scope), gets the plan approved, and then runs every step without stopping. Use this whenever someone wants to build a whole app, product, MVP or prototype from scratch with a coding agent, says "build me an app", "one shot", "end to end", "from idea to running app", "mocks, specs, designs and code", or asks for the full spec-driven workflow rather than a single document or a single feature. Not for adding a feature to an existing app (use writing-feature-prompts) or for a single artifact such as only mocks or only specs (use that skill directly).
---

# Building apps end to end

## What this produces

A running, tested app in a new repository, plus the documents that justify it, in the order they are built:

| Step | Output | Skill that does it |
| --- | --- | --- |
| 1 Idea | `docs/process/01-idea.md` | (this skill) |
| 2 Name | `docs/process/02-naming.md` | (this skill) |
| 3-4 Repo, clone | a git repo on disk, optionally on GitHub | (this skill) |
| 5 Skills | the skills copied to `.claude/skills` and `.agents/skills`, identical | (this skill) |
| 6-7 Agent files | `AGENTS.md` and pointer files | `writing-agent-instructions` |
| 8 Mocks | `docs/mocks/` | `writing-html-mocks` |
| 9 Design system | `docs/design-system/` | `extracting-design-systems` |
| 10 Specs | `docs/specs/` (L1, L2) | `writing-requirements` |
| 11 Designs | `docs/detailed-designs/` | `writing-design-documents` |
| 12 Estimates | `docs/estimates/` | `estimating-designs` |
| 13 Implementation | the app, tests, `docs/process/13-progress.md` | (this skill, below) |
| 14 Demo videos | recordings, only if the user asked | `recording-demo-videos` |

The order is the point. Each step feeds the next, and code comes last. Mocks before frontend
code, specs before design, design before estimates, estimates before slices, a failing
acceptance test before every line of implementation.

## The two stages

1. **Plan stage.** Ask, decide, write the plan, get approval. This is the only stage where the
   user is asked anything.
2. **Build stage.** Run steps 1 to 14 in order without stopping to ask. Where the plan did not
   settle a question, pick the conventional default, record it in the step's log, and carry on.

If the agent has a plan mode, do the plan stage in it and leave it only when the plan is approved.

## Plan stage

### 1. Check the ground

Before asking anything, look: is this an empty directory or an existing repo, which of the
skills above are installed (`.claude/skills`, `.agents/skills`, or the user's global skills), is
`git` available, is `gh` available and signed in, which test runner and browser tooling exist.
If a required skill is missing, say so in the plan and say what will be done instead (follow the
same step by hand, using the same output folder and format). Never silently skip a step.

### 2. Ask for what is missing

Ask in as few rounds as possible, with the question tool if there is one (batches of up to four
questions, each with a recommended default first), otherwise in one numbered chat message.
Skip anything the user already said. Ask only what changes what you build:

- **The idea**: what it is, who uses it, the three to six things it must do. If the user gave one
  sentence, propose the feature list and ask them to correct it.
- **The stack**: the user's choice, or ask to be given a recommendation and give one with a
  single sentence of reasoning. Cover front end, back end or full-stack framework, data store
  (in-memory, local file, hosted), and the test tools (unit and end to end).
- **Accounts**: whether people sign in. If yes, ask which of sign-up, sign-in, sign-out and
  sessions are needed. If no, nothing about accounts appears in any later step.
- **Look and feel**: two or three adjectives, a colour direction, light and dark or one theme,
  and any reference product. Offer a default.
- **Name**: a name they have, or ask Claude to propose four candidates with meanings (use the
  strongest model available) and pick one.
- **Repo**: create on GitHub (public or private, which account) or local only, and the parent
  folder. Creating a remote repo is outward-facing: confirm it explicitly here.
- **Scope and effort**: a target size ("a weekend", "about 15 developer-days", "everything in the
  specs") that step 12 will be compared against, and what to do if the estimate exceeds it
  (descope the smallest-value features, or keep everything).
- **Extras**: demo videos at the end (yes or no), which agents need instruction files besides
  `AGENTS.md`.
- **Production or reference**: a reference build may use in-memory data and skip deployment; a
  product needs persistence, secrets handling and a deployment note.

### 3. Write the plan

Write it to `docs/process/00-plan.md` once the repo exists, and show it before the repo does (in
plan mode, as the plan). It contains: the decisions above in a short list, the 14 steps with the
model and effort each will use, the folders that will be created, the quality gates (below), what
will not be done, and the assumptions made for anything the user did not answer. Keep it to one
screen. Then ask for approval. Do not start building on a "maybe".

## Build stage

Run every step, in order. After each one: write its log, run its gate, commit.

### Logs and commits

For every step write or append `docs/process/NN-topic.md` with the prompt given (or the skill
invoked), the model and effort, the commands run, and the output counts. Say what actually
happened; never fill a log from memory. Commit after each step with a message that names it
(`docs: add HTML mocks for every page, dialog and notification state`). Do not push unless the
plan said to create and push a remote.

### Steps 1 to 5: foundations

1. Write the idea as stated, the product description and the look and feel to `01-idea.md`.
2. Name: use the strongest model for the candidates, record them and the pick in `02-naming.md`.
3. 4. Create the repo (`gh repo create`, then `gh repo clone`, or `git init` for local only).
5. Copy the skills this workflow uses into **both** `.claude/skills` and `.agents/skills`, then
   run `diff -r` between them. It must print nothing. Keep them identical for the life of the repo.

Gate: the repo exists, the working tree is clean, the two skill folders are identical.

### Steps 6 and 7: agent files

Run `writing-agent-instructions` with the plan's description of what the project shall be: stack,
folder structure, test tools, and the guardrails below. Keep `AGENTS.md` under 150 lines because
it rides along with every turn. If you can start a fresh session, do, and prove it picks up the
skills and `AGENTS.md` with a one-shot question that lists the skills and summarizes the file.

Guardrails to put in `AGENTS.md`: mocks before frontend code; no code without a failing
acceptance test; validate every input at the boundary; parameterised queries only; no secrets
in the repo; follow the design-system tokens with no one-off colours; small components.

Gate: `AGENTS.md` exists, is under 150 lines and states those guardrails.

### Step 8: mocks

Run `writing-html-mocks` with the strongest model available and the look and feel from the plan.
Every page, dialog and notification, in every state, light and dark, responsive, keyboard
accessible, with real copy and a coverage matrix.

Gate: the coverage matrix has no missing state, and the contrast check passes for every pair.
Open the gallery page in a browser and click through a few screens to see them rendered.

### Step 9: design system

Run `extracting-design-systems` (a lighter model and low effort are enough, the mocks hold the
answers). Gate: tokens, foundations and a page per component exist, and the contrast check passes.

### Step 10: specs

Run `writing-requirements`. Gate: every L2 requirement has Given-When-Then criteria a test can
prove, each traces to an L1, and every screen and state in the mocks is covered by at least one
criterion. Fix vague criteria now.

### Step 11: detailed designs

Run `writing-design-documents`. Gate: every L2 requirement is covered by a design, every design
names the requirements it satisfies, and the diagrams render.

### Step 12: estimates

Run `estimating-designs`. Compare the total with the target from the plan and apply the rule the
user chose. If it was "descope", cut the smallest-value designs, record exactly what was cut and
why in the log, and mark those requirements deferred in the specs, so nothing is silently missing.

Gate: `docs/estimates/` has a root README with the total and a table per subsystem.

### Step 13: implementation, test first

Create `docs/process/13-progress.md`, listing every L2 requirement with a status. Then work in
slices, in dependency order: the foundation (scaffold, data layer, shell, test harness) first, then one
feature area at a time. In each slice, for each acceptance criterion, in this order:

1. Write the failing acceptance test. It names the requirement and criterion it proves
   (for example `L2-017.2`). Run it and watch it fail for the right reason.
2. Write the least code that makes it pass.
3. Run it, then everything else.

Use a page object per screen for the end-to-end tests, give every test its own isolated data so
tests can run in parallel, and add unit tests where logic has branches.

Gate after **every** slice: all unit tests, all acceptance tests, the type check and the linter
pass, the progress log is updated with what was built, the evidence per requirement, the test
counts and the decisions the code forced, and the change is committed. If a gate fails, fix it
before starting the next slice. Never record a count you did not just see in a real run.

When the code contradicts a mock, design or spec, the mock or spec is the source of truth: fix the
code. If the document is wrong, fix the document in the same slice and log why.

### Step 14: demo videos

Only if the plan said yes. Run `recording-demo-videos`. Otherwise record that it was skipped.

## Finish

Report in a few lines: what exists, where, the final test counts, the estimate against the target,
anything descoped or deferred and why, any assumption the user should check, and how to run the
app. Offer to push or deploy; do neither without being asked.

## What not to do

- Do not ask questions during the build stage. Decide, log, continue.
- Do not skip a step because it "seems unnecessary" for a small app; make it small instead.
- Do not write implementation before the failing test, even for glue code.
- Do not invent numbers, prompts or outputs in the logs.
- Do not mention or build features (accounts, deployment, offline) that the plan excluded.
- Do not push, create remote repos or deploy without explicit confirmation in the plan.
