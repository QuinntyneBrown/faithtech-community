# Feature: Marketing page at www.faithtech.community with sign-in, sign-up and Google sign-in

## Goal

Give FaithTech Community a public marketing page, served at `www.faithtech.community`, built as its own
Angular **application** project in the existing workspace: `frontend/projects/marketing/`.

What a visitor sees and can do:

- A marketing landing page that draws its look from the logged-out LinkedIn home page
  (https://www.linkedin.com/home: a split hero, headline and sub-headline on one side, the sign-in form on the
  other, "Sign in with Google", "Join now", a calm product-first layout) and from https://www.shelfie.kids/
  (warm and friendly tone, generous whitespace, a product video in the hero, short benefit sections, one clear
  call to action). It uses the FaithTech Community design system, not LinkedIn's or Shelfie's colours.
- A brochure video of 30 seconds or less, embedded on the page with a poster, captions, visible player
  controls, no autoplay with sound and respect for `prefers-reduced-motion`.
- Sign-in on the page itself (email and password, "Keep me signed in on this device", forgot-password link),
  with the same outcomes the app's sign-in page has today: incorrect credentials, locked out, suspended,
  unverified email (L2-003).
- Sign-up on the page itself (name, email, password) with the same validation and the same "check your email"
  outcome as the app's sign-up page (L2-001).
- "Sign in with Google" and "Sign up with Google" (one button, one flow): Google is a new external sign-in
  method. A Google account whose verified email matches an existing account signs into that account. A new
  Google account creates an account with no role and a verified email, as any sign-up does.
- A successful sign-in from the marketing page completes the real OAuth2 authorization code + PKCE flow and
  lands the member in the community app (home, or the page they first requested).

Where it lives today (real files):

- App shell and auth pages: `frontend/projects/faithtech-community/src/app/pages/sign-in/`,
  `.../pages/sign-up/`, `.../pages/auth-callback/`, `.../app.routes.ts`, `.../shell/public-shell.component.*`.
- Auth client: `frontend/projects/api/src/lib/auth/` (`AUTH_SERVICE` contract in `auth.service.ts`,
  `OidcAuthClient` in `oidc-auth-client.service.ts`, `authInterceptor`).
- Backend identity: `backend/src/FaithTech.Community.Application/Identity/` (`SignIn.cs`, `SignUp.cs`,
  `CommunityUser.cs`), `backend/src/FaithTech.Community.Api/Endpoints/AccountEndpoints.cs` (route group
  `/api/account`, auth rate-limit policy), `.../Endpoints/AuthorizationEndpoints.cs` (OpenIddict `/connect/*`),
  `backend/src/FaithTech.Community.Api/Authentication/AuthenticationSetup.cs` (authentication schemes and
  OpenIddict wiring), `backend/src/FaithTech.Community.Infrastructure/Identity/`.
- There is no Google or external-login code anywhere in the repository today.
- Mocks: `docs/mocks/pages/sign-in/`, `docs/mocks/pages/sign-up/`, `docs/mocks/pages/public-event/` (the only
  anonymous page today, with its "Sign in" top bar). Manifest: `docs/mocks/manifest.json`.
- Design system: `docs/design-system/` (components such as `button`, `text-field`, `form-field`, `form-layout`,
  `logo-mark`, `top-bar`, `card`, `inline-message`, `alert`; foundations incl. `theming`, `responsive`).
  Code: `frontend/projects/components/`.
- Specs: `docs/specs/L1.md` (L1-001 Identity, L1-015 Security, L1-016 Accessibility) and `docs/specs/L2.md`
  (L2-001 Sign up, L2-002 Email verification, L2-003 Sign in and sign out, L2-039 Suspend users, L2-043 Input
  validation and web protections, L2-044 Accessibility, L2-045 Responsive layout and theming). Highest number
  in use: L2-054.
- Designs: `docs/detailed-designs/identity/sign-in-and-sign-out/`, `docs/detailed-designs/identity/sign-up/`.
  Estimates: `docs/estimates/identity.md`, `docs/estimates/README.md`.
- E2E: `e2e/playwright.config.ts` (`webServer` starts `npm --prefix ../frontend start` on port 4200),
  `e2e/fixtures/mock-api.ts` (answers `/connect/authorize`, `/connect/token`, `/api/account/*`),
  `e2e/pages/sign-in.page.ts`, `e2e/pages/sign-up.page.ts`, `e2e/tests/identity/`.
- Video tooling: `eng/videos/` (Playwright journey recordings, edge-tts narration, ADR 0001) and
  `docs/videos/journeys/`.
- CI: `.github/workflows/` Frontend workflow runs `format:check`, `lint`, `test`, `build:libs`, `build`
  from `frontend/package.json`.

What stays unchanged:

- The community app's own `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password` and `/reset-password`
  pages keep working exactly as they do. Adding the Google button to the app's own sign-in page is **deferred**
  (note it, do not build it).
- Password rules, lockout, suspension, email verification and PKCE behave as L2-001 to L2-004 already say.
- Public events stay the only signed-out content inside the community app.

Deferred (note, do not build): DNS, certificates, hosting and infrastructure for `www.faithtech.community`
(`eng/infra/` and `backend/deploy/` are listed in the layout but do not exist on disk; do not create them for
this feature); other identity providers (Microsoft, Apple); Google button on the app's own sign-in page;
testimonials or pricing content; analytics or cookie banners; a blog or any other marketing page beyond this
one; SEO beyond a title, description and Open Graph image.

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: mocks, design system, screen composition,
  requirements, detailed design, estimate, incremental ATDD implementation of every slice, the brochure
  video, green tests and a pull request. Go through every phase and every slice in one continuous run. Do
  not pause between phases to report, ask for approval, or wait for "continue".
- Do not end your turn until the "Done means" list at the bottom is fully true. A partial result, a plan, or
  "the next steps would be..." is not done.
- Where `AGENTS.md` says "stop and ask", treat this prompt as the confirmation in advance for everything in
  scope here. In particular, **the user has approved these layout changes**, and `AGENTS.md` must be updated
  in the same change, before any code lands in the new locations:
  - `frontend/projects/marketing/` — a second Angular **application** project: the public marketing page
    served at `www.faithtech.community`. It composes `components` and `api` only. No feature pages, no
    `HttpClient`, no dependency on `faithtech-community` or any feature library.
  - `eng/videos/brochure/` — the brochure video source (script, timed slide deck, build command).
  - The rendered brochure video, poster and captions ship as static assets of the marketing app
    (`frontend/projects/marketing/public/`).
  - `docs/detailed-designs/marketing/`, `docs/estimates/marketing.md`, `e2e/tests/marketing/` follow from the
    "same feature name everywhere" rule.
  Choose the simplest option that fits the existing architecture, record it (an ADR in `docs/adr/`, next
  number after 0016, or the design's open-questions section), and keep going.
- If `components` lacks something, that is not a reason to stop. Update the design system and the library
  first, as the project rules require, then go on.
- When a test, build or command fails, find the root cause and fix it, then go on. Never weaken a test to
  make it pass, and never skip a step quietly.
- Only stop for a real blocker you cannot resolve yourself, such as missing credentials, or an action outside
  this repository that can't be undone, such as production deploys, DNS or Google Cloud console changes. Real
  Google credentials are **not** needed: the backend reads the Google client id and secret from
  configuration, tests fake the provider behind an abstraction, and the e2e fake answers the Google flow. If
  something blocks you, finish everything else first, then report the blocker clearly.
- Keep track of progress (a todo list), so that nothing gets left out after context is summarised.

## Rules (read first, binding)

- Follow `AGENTS.md` exactly, especially:
  - Repository layout is mandatory. Only the layout changes listed above are approved; update the tree in
    `AGENTS.md` first. No other new top-level folders or projects.
  - Components library is mandatory. Buttons (including a social sign-in button variant for Google), text
    fields, form fields, inline messages, alerts, cards, logo mark, top bar, footer, the hero and the video
    player come from `frontend/projects/components/`, matching `docs/design-system/`. Add anything missing
    there first. Never hand-roll a substitute in the marketing app.
  - Anything the marketing app and the community app both need (the sign-in form, the sign-up form, their
    error mapping) moves into `components` (presentation) and `api` (service contract and token). Do not copy
    code between the two apps.
  - Pages depend on `AUTH_SERVICE` (the injection token), never on `HttpClient` or the concrete client.
  - Business rules live in Application handlers. Endpoints are authenticated by default; the marketing page's
    sign-in, sign-up and Google endpoints are anonymous **by explicit opt-in** and sit under the existing
    `/api/account` rate-limited group. Every permission check is on the server.
  - Google sign-in: validate the Google token on the server (issuer, audience, expiry, `email_verified`);
    use `state` and a nonce; link to an existing account only by a verified matching email; never create a
    role; refuse suspended accounts with the same message as password sign-in; keep client id and secret out
    of the repo (configuration and environment variables).
  - Backend tests: EF Core in-memory provider, uniquely named database per fixture, fakes behind abstractions
    (Google token validation, email, breached-password check, time). No Docker, no Postgres, no network.
  - E2E: Playwright, Chromium only. **The suite must pass with no backend running.** Every request the
    marketing app makes, including the Google flow, is answered by the fake in `e2e/fixtures/`; an unrouted
    request fails the test. `webServer` may start the marketing app on its own port next to the community
    app, but never the API, Cli, a database or a container. One page object per screen in `e2e/pages/`;
    no selectors in specs; axe check on the marketing page in every state.
  - WCAG 2.2 AA on every screen: keyboard reachable, visible focus, labelled controls, captions on the
    video, no autoplay with sound, sufficient contrast in light and dark. Tokens by role, never hex.
    Prettier and angular-eslint pass. No inline forms in pages: the sign-in and sign-up forms on the
    marketing page are the page's own purpose, so they are the exception the mock and design must show;
    anything else that edits opens a CDK Dialog or navigates.
  - Journey videos are recordings, not tests. The brochure video is a marketing asset, not a journey video:
    keep it out of `docs/videos/journeys/` and out of the acceptance run.
  - Never write architecture tests.
- Invoke and follow the `implementing-incrementally` skill before writing any production code.
- If something seems to need more scope, leave it out, note it as deferred, and continue.
- Work through the phases below **in order**, using the skill each phase names.
- Copy the house style of each folder. Read the existing neighbours (the `sign-in` and `sign-up` mocks, the
  identity designs, `e2e/tests/identity/`, `docs/prompts/team-prompt.md`) before you write anything new.

## Phase 1: Mocks (`writing-html-mocks`)

- Add `docs/mocks/pages/marketing/` for every state, light and dark, at phone, tablet and desktop widths.
  Suggested states (adjust as needed): `default` (hero with video, sign-in form, "Join now" and Google
  button), `sign-in-busy`, `sign-in-invalid`, `sign-in-error` (incorrect credentials), `locked`, `suspended`,
  `unverified` (resend verification), `sign-up` (the join form shown), `sign-up-invalid`, `sign-up-busy`,
  `sign-up-success` (check your email), `google-busy`, `google-failed` (Google refused or the account is
  suspended), `video-unavailable` (poster and transcript link shown when the video cannot play),
  `reduced-motion`.
- Take composition cues from the two inspiration sites (split hero with the form beside the headline at
  desktop, stacked at phone; short benefit sections below; one footer) but every colour, type and spacing
  value comes from `docs/design-system/tokens/`.
- Reuse the mock cast and catalogue in `docs/mocks/README.md`; screenshots in the hero come from existing
  mocks or `docs/design-system/assets/photos/`.
- Update `docs/mocks/manifest.json`, the gallery `docs/mocks/index.html` and the coverage matrix.

## Phase 2: Design system (`extracting-design-systems`)

- Update `docs/design-system/` for the components that change or are new. Likely: a `hero` component, a
  `video-player` component (poster, captions, controls, reduced-motion and unavailable states), a social
  sign-in variant of `button` that follows Google's brand guidelines for the "Sign in with Google" button, a
  `footer` component, a marketing `top-bar` variant, and the `form-layout` arrangement for the in-page sign-in
  and sign-up forms. Change tokens only if this needs new values.
- Update `docs/screen-composition.md` (`writing-screen-composition`) with the new marketing page and its
  components, and with any change to the app's sign-in and sign-up pages caused by moving their forms into
  `components`.

## Phase 3: Requirements (`writing-requirements`)

- Add an L1 entry for the marketing page (next free number after L1-019, mock area tag `MKT`) and extend
  L1-001 to name Google as an external sign-in method.
- Add new L2 requirements, numbered from **L2-055**, with Given/When/Then acceptance criteria covering:
  - The marketing page: what an anonymous visitor sees at `www.faithtech.community`; the brochure video
    (30 seconds or less, poster, captions, controls, no autoplay with sound, reduced-motion, unavailable);
    responsive layout and theming; accessibility; the signed-in redirect (a member who already has a session
    lands in the community app).
  - Sign-in on the marketing page: every outcome from L2-003 criteria 1, 2, 3, 4 and 8 reached from the
    marketing page, and landing in the community app at the right URL.
  - Sign-up on the marketing page: every outcome from L2-001 reached from the marketing page.
  - Google sign-in: new account with no role and verified email; existing account matched by verified email;
    unverified Google email refused; suspended account refused; invalid or replayed state or token refused;
    the audit of account creation if the existing sign-up audits it; no secret in the repo.
  - Security and privacy: rate limiting on the auth group, no user-enumeration difference between the Google
    and password paths, CSP and frame-ancestors for the embedded video, no third-party trackers.
- Cross-reference L2-001, L2-002, L2-003, L2-004, L2-039, L2-043, L2-044 and L2-045 instead of copying them.

## Phase 4: Detailed design (`writing-design-documents`)

- Add `docs/detailed-designs/marketing/landing-page/` and `docs/detailed-designs/identity/google-sign-in/`
  in the house style (README, requirements table, acceptance criteria, rendered C4 context, container and
  component diagrams, class and sequence diagrams). Cover:
  - Hosting shape: the marketing app on `www.faithtech.community`, the community app on its own host (read
    from configuration), the API's allowed origins and OpenIddict redirect URIs for the marketing app
    (seeded idempotently), and how the marketing page hands a signed-in session to the community app.
  - Backend: the Google external sign-in endpoints under `/api/account`, the handler in
    `Application/Identity/`, the token-validation abstraction in Infrastructure, configuration keys, and how
    `SignInHandler` rules (suspension, verified email) are reused rather than duplicated.
  - Data: any change to `CommunityUser` (external login link) and its migration in
    `Infrastructure/Persistence/Migrations/`.
  - Frontend: the marketing app's shell, routes, the shared sign-in and sign-up form components, the video
    player, the `AUTH_SERVICE` contract additions for Google, and the e2e fake's Google flow.
  - Video: the source in `eng/videos/brochure/`, the build command, the 30-second limit and the shipped assets.
- Record real decisions in ADRs: the second application project and the layout change, the Google account
  linking rule, and where the brochure video lives.
- Update the existing designs this touches (`identity/sign-in-and-sign-out`, `identity/sign-up`,
  `platform/responsive-layout-and-theming` if the marketing shell differs) only where needed.

## Phase 5: Estimate update (`estimating-designs`)

- Add `docs/estimates/marketing.md` with `landing-page` at 0%, add `google-sign-in` to
  `docs/estimates/identity.md` at 0%, roll both into `docs/estimates/README.md`, and update them again when
  the work is done.

## Phase 6: Incremental implementation (ATDD)

Plan thin vertical slices. Suggested order (adjust as needed):

1. Workspace: add the `marketing` application project to `angular.json`, `package.json` scripts (`start`,
   `build`, `test`, `lint` cover it; CI's Frontend workflow builds it), `tsconfig` paths, Prettier and
   eslint; a Playwright `webServer` entry and a `marketing` base URL; a smoke spec that opens the page, sees
   the headline, and passes axe.
2. Marketing page content: hero, benefit sections, footer, responsive and themed; axe in light and dark.
3. Brochure video: write the script (30 seconds or less) and the timed deck in `eng/videos/brochure/`,
   render the video with `creating-narrated-videos` (edge-tts narration, captions), check its duration, ship
   the video, poster and WebVTT captions as marketing assets, and build the `video-player` component with
   its states (playing, reduced-motion, unavailable).
4. Shared forms: move the sign-in and sign-up form presentation into `components`, keep the community app's
   pages green on the shared components, then place them on the marketing page.
5. Sign-in from the marketing page: all L2-003 outcomes and the hand-off into the community app, against the
   e2e fake.
6. Sign-up from the marketing page: all L2-001 outcomes and the verify-email outcome.
7. Google sign-in, backend: endpoints, handler, token validation abstraction, configuration, migration,
   seeded OpenIddict client; integration tests for new account, matched account, unverified email,
   suspended account, bad state or token, rate limit.
8. Google sign-in, frontend: `AUTH_SERVICE` additions, the button, busy and failed states, the e2e fake's
   Google flow, Playwright spec.
9. Signed-in visitor: a member with a valid session who opens the marketing page is taken to the community
   app.

For each slice:

- Write the Given-When-Then criteria.
- Write the acceptance test, traced to its requirement (backend integration test, Angular unit test or
  Playwright spec, at the level where the behaviour is visible).
- Run it and show that it fails for the expected reason.
- Implement the minimum that makes it pass, and refactor while the tests are green.
- Run the regression checks (backend tests, `npm run format:check`, `npm run lint`, `npm test`,
  `npm run build:libs`, `npm run build`, the Playwright suite), then commit.
- Do not start the next slice until the checks pass.

When all slices are green, update the estimates to their true percent complete and keep the mocks, design
system, screen composition and designs aligned with what was built. Add `docs/prompts/marketing-prompt.md`
only if the repository's convention is to keep the prompt that drove a feature; copy it from this file.

## Done means

- An anonymous visitor at `www.faithtech.community` (locally, the marketing app's dev server) sees the
  marketing page with a brochure video of 30 seconds or less, can sign in, sign up, or sign in with Google
  from the page, and lands in the community app with a real PKCE session, with every rule enforced on the
  server.
- The community app's own identity pages still pass their tests, now on the shared form components.
- All new and existing backend, Angular unit and Playwright tests pass with no backend running for e2e;
  lint, format and both builds are clean; CI builds the marketing app.
- The documentation agrees with the code: `AGENTS.md` layout tree, mocks, design system, screen
  composition, L1 and L2, detailed designs, ADRs and estimates.
- The work is on a branch with a pull request to `main`, and its checks are green. Fetch and rebase first.
