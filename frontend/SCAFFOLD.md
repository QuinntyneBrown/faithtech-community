# SCAFFOLD: frontend workspace

Everything under `frontend/` was scaffolded from `AGENTS.md`, the detailed designs in `docs/detailed-designs/` and the design system in `docs/design-system/`. It is structure only: every component, page, dialog, service, guard, interceptor and spec is a placeholder that MUST be overwritten with the expected implementation. Find the placeholders with:

```sh
grep -rl "SCAFFOLD" projects
```

Each scaffolded file starts with a `SCAFFOLD` comment that names its sources. Each folder has a `SCAFFOLD.md` with the same information. When you implement a file, follow the `implementing-incrementally` skill and ATDD in `AGENTS.md`, then delete its `SCAFFOLD` comment, and delete a folder's `SCAFFOLD.md` once nothing in it is a placeholder.

## What the scaffold contains

- `projects/faithtech-community`: the app. Root component, provisional routes that lazy-load every feature library, `authGuard`, `AppShellComponent`, identity pages and error pages.
- `projects/components` (`@faithtech-community/components`): one component per entry in `docs/design-system/components/`, plus `ThemeService`, `BreakpointService`, `ConnectivityService`, `DialogService`, `ToastService` and `FormErrorFocusDirective`. `src/styles/` holds the tokens, themes, foundations and utilities copied from `docs/design-system/`.
- `projects/api` (`@faithtech-community/api`): one contract, injection token and `Http*` implementation per service named in the designs, `authInterceptor`, `httpErrorInterceptor`, `API_BASE_URL` and `provideApi()`.
- Feature libraries (`@faithtech-community/<feature>`): pages, dialogs and a `<feature>.routes.ts` per library, named as in the detailed designs.
- Unit tests: a `*.spec.ts` beside every component, page, dialog, service, guard, interceptor and directive containing only `describe.todo(...)`. Write the real tests first when you implement each slice.
- Tooling: angular-eslint (with template accessibility rules, OnPush and no inline templates or styles), Prettier, Husky + lint-staged pre-commit hook, barrels (`index.ts`) in every folder and a `public-api.ts` per library.

## Conventions baked in

- Selector prefix `ft`. Class suffixes `Component`, `Page`, `Dialog`, `Container`, `Directive`.
- No single-file components: every component has separate `.ts`, `.html`, `.scss` and `.spec.ts` files, enforced by `@angular-eslint/component-max-inline-declarations`.
- Every component uses `ChangeDetectionStrategy.OnPush`.
- The app and specs resolve `@faithtech-community/*` to library sources; library builds resolve them to `dist/` (`npm run build:libs` builds in dependency order).

## Not scaffolded

- Playwright acceptance tests (`e2e/`): written per slice with ATDD, not as scaffold.
- The `agile` feature: its designs exist, but `AGENTS.md` does not list an `agile` library yet, so it needs approval first.
