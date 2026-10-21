# Effort heuristics

Estimates are developer-days for an intermediate developer who knows the
project's stack and works under its `AGENTS.md` process. They cover everything a
design needs to be done: implementation, acceptance tests, accessibility and
review fixes. They exclude waiting time, meetings and work listed as deferred.

## Baseline

`baseline = behaviours + 1`

- **Behaviours** are the design's `### Behaviour` sections, or its sequence
  diagrams when the headings are absent. `scripts/estimates.py inventory`
  counts both.
- **The extra day** is setup: routes, wiring, page objects, fixtures and the
  first failing acceptance test.

## Adjustments

Apply each that the design README actually describes. Do not stack two
adjustments for the same piece of work.

| Signal in the design | Adjustment |
|---|---|
| New data table or migration | +0.5 day per table |
| File upload, storage or image processing | +1 day |
| Search, filtering, sorting or pagination over data | +0.5 to 1 day |
| External integration (payment, email, third-party API, identity provider) | +1 to 2 days |
| Background job, queue, schedule or webhook | +1 day |
| Real-time updates (websocket, server-sent events, polling) | +1 day |
| Tricky accessibility: dialog, menu, combobox, drag and drop, focus management | +0.5 day each |
| Complex validation, state machine or authorization rules | +0.5 to 1 day |
| Reuses an existing component, endpoint or table named in the Description | -0.5 day each, never below 2 days in total |
| Read-only view over existing data with no new endpoint | -1 day |

## Rounding and range

- Round to whole days. Most designs land between **2 and 7 days**.
- **1 day** is valid only for a trivial design with one behaviour that reuses
  everything.
- **Above 10 days** means the slice is too large. Keep the estimate, and
  recommend splitting the design in the reply.

## Worked example

Design `lending/renew-loan` has 2 behaviours (renew, renewal refused), 4 L2
requirements, adds a `renewals` table, reuses the existing loan endpoint and
shows a confirmation dialog.

| Step | Days |
|---|---|
| Baseline: 2 behaviours + 1 | 3 |
| New table | +0.5 |
| Confirmation dialog | +0.5 |
| Reuses loan endpoint | -0.5 |
| Total, rounded | **4 days** (3.5 rounds half up) |

## Percent complete evidence

| Evidence for a behaviour | Counts as |
|---|---|
| Implementation and an acceptance test that exercises it (and passes, when run) | done |
| Implementation without a test | not done |
| Test without implementation, or a failing test | not done |
| Nothing found | not done |

Weight each done behaviour by its share of the design's effort, then round to
the nearest 10%. With two equal behaviours and one done, a design is 50%
complete. Setup work alone never moves a design above 0%.
