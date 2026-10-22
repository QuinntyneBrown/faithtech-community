# Estimates

- Overall effort: 317 days
- Complete: 97%
- Visual conformance: letter grade (F to A+) of the implemented UI against the HTML mocks and design system (margins, spacing, fonts, borders), from screenshots in `docs/videos/journeys/<journey>/screenshots/`. Subsystem grades are the rounded mean of their designs. The marketing page and Google sign-in have no journey screenshots yet, so they are not graded (n/a).

| Subsystem | Effort | Complete | Visual conformance |
|---|---|---|---|
| [platform](platform.md) | 33 days | 84% | C+ |
| [identity](identity.md) | 23 days | 98% | A- |
| [profiles](profiles.md) | 13 days | 100% | B- |
| [admin](admin.md) | 17 days | 99% | B |
| [invites](invites.md) | 14 days | 100% | A- |
| [contacts](contacts.md) | 30 days | 100% | B |
| [partners](partners.md) | 19 days | 100% | B- |
| [team](team.md) | 2 days | 100% | A- |
| [events](events.md) | 29 days | 100% | B |
| [notifications](notifications.md) | 9 days | 100% | B- |
| [announcements](announcements.md) | 8 days | 100% | B- |
| [search](search.md) | 4 days | 90% | B |
| [agile](agile.md) | 36 days | 99% | B- |
| [marketing](marketing.md) | 8 days | 95% | n/a |
| [resources](resources.md) | 23 days | 99% | — |
| [notes](notes.md) | 42 days | 98% | — |
| [reports](reports.md) | 7 days | 100% | B |

## Roadmap

1. platform: deploy behind the private-preview wall (the owner's runbook, `platform/private-preview-wall`)
2. platform and identity: finish the remaining designs
3. admin, search and agile: finish the remaining designs
4. marketing page and Google sign-in, and resources: finish the remaining designs
5. notes: block-editor (the mouse path into the Turn into submenu) and pages-and-list (measure the 500-block read and save latency)
6. Deferred: notes co-editing, version history, purging archived pages and orphaned-image clean-up
