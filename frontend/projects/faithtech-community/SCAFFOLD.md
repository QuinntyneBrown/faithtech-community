# SCAFFOLD: project `faithtech-community`

This folder was scaffolded from `AGENTS.md` and the sources below. Everything in it is a placeholder, not the implementation. Overwrite each file with the expected implementation (follow the `implementing-incrementally` skill and ATDD in `AGENTS.md`), then delete the `SCAFFOLD` comments and this file.

The app: shell, top-level routes that lazy-load the feature libraries, auth guards, and the identity and error pages that precede any feature library. No feature pages.

Sources:

- `docs/detailed-designs/platform/responsive-layout-and-theming`
- `docs/detailed-designs/identity/sign-in-and-sign-out`
- `docs/design-system/patterns/navigation.html`
- `docs/detailed-designs/identity`
- `docs/detailed-designs/platform/error-and-system-pages`
- `docs/detailed-designs/identity/password-reset`
- `docs/detailed-designs/identity/sign-up`
- `docs/mocks/pages/home (no detailed design yet: TO CONFIRM which library owns it)`
- `docs/detailed-designs/identity/email-verification`
- `docs/detailed-designs/profiles/view-profile`

## Open questions (TO CONFIRM before implementing)

- `HomePage` comes from the `docs/mocks/pages/home` mock only; there is no detailed design yet, so which library owns it is open.
- The `docs/mocks/pages/offline` state is covered by `ConnectivityService` + `BannerComponent` in the shell (platform/error-and-system-pages); no offline page was scaffolded.
- Route paths in `app.routes.ts` and each `*.routes.ts` are provisional.
