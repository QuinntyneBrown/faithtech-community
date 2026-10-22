# 0017. Marketing application and session hand-off

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-021, L2-067 to L2-070, L2-072
- Designs: `docs/detailed-designs/marketing/landing-page`, `docs/detailed-designs/identity/google-sign-in`

## Context

FaithTech Community needs a public marketing page at `www.faithtech.community` where a visitor can sign in, sign up or sign in with Google, and then land in the community app with a real authorization code + PKCE session. The community app is served on its own host (`WebApp:Origin`, for example `app.faithtech.community`) behind the same reverse proxy as the API and the identity server (`/api`, `/connect`). Public events are the only signed-out content inside the community app and must stay that way. The repository layout is mandatory; the implementation prompt for this feature (`docs/prompts/marketing-prompt.md`) approved `frontend/projects/marketing/` as a second Angular application and `eng/videos/brochure/` for the brochure video source.

## Decision

- **A second application project.** `frontend/projects/marketing/` is an Angular application in the existing workspace, served by its own dev server (port 4300) and built by `npm run build` next to the community app. It depends only on `components` and `api`, never on the community app or a feature library, and never calls `HttpClient`.
- **Shared forms, not copies.** The sign-in and sign-up forms move into `components` (`ft-sign-in-form`, `ft-sign-up-form`) and their error mapping into `api` (`signUpFieldErrors`). The community app's `/sign-in` and `/sign-up` pages and the marketing page compose the same components.
- **The marketing page collects credentials; the community app owns the session.** The marketing app calls the API on the community origin (`provideApi('<community>/api')`) with credentials. A successful `POST /api/account/sign-in` sets the existing short-lived `ftc.session` cookie on the community host, exactly as it does for the app's own sign-in page. The marketing app then navigates to `<community>/auth/continue?returnUrl=…&keepSignedIn=…`, a new app shell route next to `/auth/callback` that calls `AUTH_SERVICE.signIn()`. The PKCE verifier, the state, the tokens and the refresh token therefore live in the community app's own storage, and `/connect/authorize` sees the cookie and issues a code to the existing `web` client.
- **No second OpenIddict client.** Tokens issued to a marketing client would sit in the wrong origin's storage and would need a second hand-off. The seeded `web` client and its redirect URIs are unchanged; the API only adds the marketing origin to its CORS policy (`Marketing:Origin`) and allows credentials so the session cookie can be set from the marketing page. `www.faithtech.community` and the community host are the same site, so the `SameSite=Lax` cookie is sent.
- **Signed-in visitors.** The refresh token lives on the community origin, which the marketing page cannot read. When the community app stores a "keep me signed in" session it also writes a non-secret hint cookie, `ftc.signed-in=1`, for the shared parent domain (`AuthConfig.sessionHintDomain`; host-only on `localhost`), and clears it on sign-out or when a stored session cannot be restored. The marketing app sends a visitor with the hint straight to the community app, which still validates the session itself. The hint grants nothing.
- **Hosting is configuration.** The marketing app reads the community origin from build configuration: `COMMUNITY_ORIGIN` is provided in `app.config.ts` and defaults to the dev server (`http://localhost:4200`); production builds replace it through `fileReplacements`. DNS, certificates, hosting and infrastructure are deferred.

## Consequences

- `AGENTS.md` lists `frontend/projects/marketing/` and `eng/videos/brochure/`; `docs/detailed-designs/marketing/`, `docs/estimates/marketing.md` and `e2e/tests/marketing/` follow the same-name rule.
- Playwright starts both dev servers (4200 and 4300); the fake backend answers requests from either origin, adding the CORS headers the real API sends.
- A session that is not "kept" (session storage) is per tab and is not visible to the marketing page; such a visitor sees the marketing page and signs in again, which matches L2-003 AC8.
