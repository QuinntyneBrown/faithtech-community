---
name: estimating-designs
description: >-
  Create or refresh docs/estimates/: a root README with the overall effort,
  effort-weighted percent complete and a brief roadmap, plus one brief table
  per subsystem giving each detailed design's developer-day estimate and
  evidence-based percent of implementation complete. Use when the user asks
  for estimates, effort, sizing, how long features will take, progress,
  percent complete, how far along the implementation is, or a roadmap, and
  docs/detailed-designs/ exists.
---

# Estimating designs

This skill turns the detailed designs in `docs/detailed-designs/` into
`docs/estimates/`: one brief table per subsystem and a root summary. Each design
is `docs/detailed-designs/{subsystem}/{feature}/README.md`, the shape the
writing-design-documents skill produces.

```
docs/estimates/
├── README.md          overall effort, percent complete, subsystem table, roadmap
└── {subsystem}.md     one row per feature design
```

Resolve `scripts/` and `references/` relative to this installed skill's folder.
Resolve `docs/` paths relative to the consuming project, not the skill folder.
Read `references/heuristics.md` before estimating effort and
`references/example-estimates.md` before writing the files.

## Step 0 - Designs gate

Check that `docs/detailed-designs/` exists and holds at least one
`{subsystem}/{feature}/README.md`. **If it does not, stop and tell the user**
that estimates are made per detailed design and that the
writing-design-documents skill (or hand-written designs in that shape) comes
first. Do not estimate from requirements, notes or code alone, and do not create
`docs/estimates/`.

## Step 1 - Inventory the designs

Run the bundled inventory. It lists every feature design with the counts the
heuristics start from: behaviours (`### Behaviour` headings or `sequence*.puml`
files), L2 requirements, components and data tables mentioned.

```sh
python "<installed-skill-folder>/scripts/estimates.py" inventory docs/detailed-designs
```

Then read each design README. The counts are a starting point; the prose decides
what is new, reused, integrated or hard.

## Step 2 - Learn the project context

Read the consuming project's `AGENTS.md` (and `CLAUDE.md` if it holds the rules)
for:

- **Stack and process.** Estimates are developer-days for an intermediate
  developer who knows the project's stack and follows its process (for example
  ATDD, page objects, mocked APIs, WCAG 2.2 AA). Name the stack in one sentence
  of the root README only if the user asks; otherwise keep it implicit.
- **Source and test layout.** Where implementation and acceptance tests live;
  this is where Step 4 looks for evidence.
- **Deferred work.** Any section listing deferred or out-of-scope work.

If `AGENTS.md` is missing, infer the stack and layout from the repository
(package manifests, solution files, `src/`, `tests/`) and say so in the reply.

## Step 3 - Estimate effort

Follow `references/heuristics.md`:

1. Start from about **1 day per behaviour plus 1 day of setup**.
2. Add time for new data tables, file uploads, search or filtering, external
   integrations, background jobs, real-time updates and tricky accessibility
   (dialogs, menus, drag and drop).
3. Subtract time when the design reuses existing code.
4. Round to whole days, typically 2 to 7. A design that comes out above 10 days
   is too large a slice; estimate it anyway and mention it in the reply.

**Refreshing:** keep an existing estimate unless the design changed since it was
written (check `git log` on the design folder). Stable estimates make progress
comparable over time.

## Step 4 - Measure percent complete from evidence

Never guess. For each design:

1. List its behaviours and L2 requirements.
2. For each behaviour, look for its implementation in the source layout from
   Step 2 **and** a passing or at least present acceptance test that exercises
   it. Use `git log --oneline`, file search for the feature's component and
   route names, and test titles or requirement IDs in tests. A behaviour counts
   as done only when both implementation and test exist.
3. Complete = done behaviours / total behaviours, weighted roughly by each
   behaviour's share of the effort, rounded to the nearest 10%. Use **0%** when
   nothing exists and **100%** only when every behaviour and requirement is
   implemented and tested.

If the tests can be run cheaply, run them; a failing test means its behaviour is
not done. Otherwise state in the reply that presence, not passing, was checked.

## Step 5 - Write the subsystem files

One `docs/estimates/{subsystem}.md` per subsystem folder, using the subsystem
folder name exactly. Keep it extremely brief: a title and a table, nothing else.

```markdown
# Estimates: {subsystem}

| Design | Effort | Complete |
|---|---|---|
| {feature} | {n} days | {p}% |
```

- One row per feature folder, sorted alphabetically, named exactly as the folder.
- Write `1 day` for one and `{n} days` otherwise.
- No prose, notes or totals. The single permitted exception is the deferred-work
  line in Step 7.

## Step 6 - Write the root README

Run the rollup to compute the subsystem and overall figures. It reads the
subsystem files, so write those first:

```sh
python "<installed-skill-folder>/scripts/estimates.py" rollup docs/estimates
```

Subsystem effort is the sum of its designs. Subsystem and overall complete are
effort-weighted (sum of effort x complete / total effort), rounded to whole
percent. Copy the printed figures; do not recompute them by hand.

```markdown
# Estimates

- Overall effort: {total} days
- Complete: {p}%

| Subsystem | Effort | Complete |
|---|---|---|
| [{subsystem}]({subsystem}.md) | {n} days | {p}% |

## Roadmap

1. {subsystem(s) or design(s)}
```

- **Delivery order.** Table rows and roadmap steps run in delivery order:
  unfinished in-progress work first, then the remaining subsystems ordered by
  dependency (foundations such as identity, accounts and core entities before
  the features that consume them). Derive dependencies from the designs'
  C4 and class diagrams and requirement links.
- **Roadmap.** About five one-line steps. Drop finished subsystems. Each step
  names subsystems or individual designs, never dates.

## Step 7 - Deferred work

Work that the project's `AGENTS.md` lists as deferred does not count toward
percent complete or the roadmap's unfinished steps. Where a design has deferred
parts, score only the rest and add this line directly under that subsystem's
table:

```markdown
Excludes deferred work (see AGENTS.md).
```

End the root roadmap with one final step, `Deferred: {what}`, naming it. With no
deferred work, add neither.

## Step 8 - Verify before finishing

```sh
python "<installed-skill-folder>/scripts/estimates.py" check docs/detailed-designs docs/estimates
```

The check fails when a subsystem or feature folder has no file or row, a row has
no folder, rows are not alphabetical, a cell is malformed, a subsystem file holds
extra prose, or the root README's figures disagree with the rollup. Fix every
reported problem and re-run until it exits cleanly. Python 3 with the standard
library is all it needs.

Then reply with the overall effort and percent complete, the roadmap's first
step, and any caveats: designs over 10 days, tests checked for presence only, or
a missing `AGENTS.md`.

## Refreshing

Overwrite the existing files. Keep effort estimates stable unless the design
changed, recalculate every percentage from the current code, and add or remove
rows and files as designs are added or removed.
