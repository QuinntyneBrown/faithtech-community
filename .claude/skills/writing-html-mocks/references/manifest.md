# manifest.json

`docs/mocks/manifest.json` is the single list of screens. `scripts/check_mocks.py`
reads it to verify coverage, finds orphan files and, with `--write`,
regenerates the coverage matrix in `README.md` and the gallery `index.html`.

```json
{
  "project": "Shelf",
  "required_states": {
    "page": ["default", "loading", "empty", "error"],
    "dialog": ["default", "busy", "invalid"],
    "notification": ["info", "success", "warning", "danger"]
  },
  "screens": [
    {
      "id": "loans",
      "kind": "page",
      "title": "Loans",
      "route": "/loans",
      "requirements": ["L2-LOAN-001", "L2-LOAN-004"],
      "states": ["default", "loading", "empty", "error", "no-results", "selected"],
      "not_applicable": {}
    },
    {
      "id": "return-loan",
      "kind": "dialog",
      "title": "Return loan",
      "opens_from": "loans",
      "requirements": ["L2-LOAN-006"],
      "states": ["default", "busy", "invalid", "failed"]
    },
    {
      "id": "settings",
      "kind": "page",
      "title": "Settings",
      "route": "/settings",
      "states": ["default", "loading", "error", "invalid", "submitting", "success"],
      "not_applicable": { "empty": "Settings always has values; there is no empty collection." }
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `project` | yes | Product name used in the README and gallery titles. |
| `required_states` | no | Overrides the default minimum per kind (shown above). Add to it; do not remove states to make the check pass. |
| `screens[].id` | yes | Kebab-case folder name under `pages/`, `dialogs/` or `notifications/`. |
| `screens[].kind` | yes | `page`, `dialog` or `notification`. |
| `screens[].title` | yes | Human title, used in the gallery and the mock bar. |
| `screens[].route` | pages | The URL path, for traceability to the router. |
| `screens[].opens_from` | dialogs, notifications | The page id the overlay appears on. |
| `screens[].requirements` | when specs exist | L2 identifiers, copied verbatim from `docs/specs/`. Also written to `<meta name="mock:requirements">` in each file. |
| `screens[].states` | yes | Every state that has a file at `<kind-folder>/<id>/<state>.html`. |
| `screens[].not_applicable` | no | `{ "state": "reason" }` for required states that cannot occur. An empty reason fails the check. |

File naming is derived, never configured: `pages/loans/no-results.html`,
`dialogs/return-loan/busy.html`, `notifications/loan-toast/stacked.html`.
Every HTML file under those three folders must be listed; the check reports
orphans so a forgotten entry cannot hide a mock from the gallery.
