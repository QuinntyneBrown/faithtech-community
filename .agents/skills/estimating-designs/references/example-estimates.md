# Worked example - finished estimates

A library system with two subsystems, `catalog` and `lending`. The designs live
in `docs/detailed-designs/catalog/{add-book,search-books}/` and
`docs/detailed-designs/lending/{checkout-book,renew-loan,return-book}/`. The
project's `AGENTS.md` lists overdue fines as deferred.

## docs/estimates/catalog.md

```markdown
# Estimates: catalog

| Design | Effort | Complete |
|---|---|---|
| add-book | 3 days | 100% |
| search-books | 5 days | 60% |
```

## docs/estimates/lending.md

```markdown
# Estimates: lending

| Design | Effort | Complete |
|---|---|---|
| checkout-book | 4 days | 50% |
| renew-loan | 4 days | 0% |
| return-book | 3 days | 0% |

Excludes deferred work (see AGENTS.md).
```

## docs/estimates/README.md

The rollup gives:

- catalog: 3 + 5 = 8 days; (3 x 100 + 5 x 60) / 8 = 75%
- lending: 4 + 4 + 3 = 11 days; (4 x 50) / 11 = 18.2, so 18%
- overall: 19 days; (300 + 300 + 200) / 19 = 42.1, so 42%

```markdown
# Estimates

- Overall effort: 19 days
- Complete: 42%

| Subsystem | Effort | Complete |
|---|---|---|
| [catalog](catalog.md) | 8 days | 75% |
| [lending](lending.md) | 11 days | 18% |

## Roadmap

1. Finish catalog search-books
2. Finish lending checkout-book
3. Lending renew-loan and return-book
4. Deferred: overdue fines
```

Catalog comes first because it is in progress and lending depends on books
existing. The roadmap names designs, not dates, and ends with the deferred step.
