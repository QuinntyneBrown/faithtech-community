# 0023. Private preview wall and hosting

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-022, L2-085 to L2-094
- Designs: `docs/detailed-designs/platform/private-preview-wall`, `docs/detailed-designs/platform/server-authorization`

## Context

FaithTech Community is about to be deployed to `app.faithtech.community` and `www.faithtech.community` (ADR 0018 left hosting, DNS, certificates and infrastructure for later). While it is in private preview, only the owner may see it: every other visitor must see one neutral unlock page that gives nothing about the product away, and every other request, including the API, the identity server, SignalR and static files, must be refused. A client-side check is not a wall. The repository layout reserves `backend/deploy/` for containers and `eng/infra/` for Azure infrastructure.

## Decision

- **The API serves everything, and the wall is its first middleware.** One ASP.NET Core container serves the API, the identity server, the SignalR hub and both production Angular builds, choosing the build by host (`WebApp:Origin` → community app, `Marketing:Origin` → marketing page). There is no separate reverse proxy or gate service. `PrivatePreviewGateMiddleware` runs after the correlation ID, the security headers and the request log, and before the exception handler, the status code pages, static files, CORS, authentication and routing, so a locked request reaches nothing and its response is exactly what the gate writes. Rules live in `Application/PrivatePreview/`, hashing and signing in `Infrastructure/PrivatePreview/` (layer rules in `AGENTS.md`).
- **The wall page is rendered by the server, not Angular.** Loading an app bundle, the components library (`ft-` selectors) or the shared stylesheet would describe the product before the visitor has unlocked. The gate renders an embedded `wall.html` that inlines the design system's card, form field, alert and button rules by role under a per-response CSP nonce, with the neutral accent scope (`docs/design-system/tokens/neutral-accent.css`) so the brand colour does not appear. This is a deliberate exception to "every screen is composed from `components`": the page exists before, and outside, both applications. The e2e fake renders the same file.
- **One passphrase, stored as PBKDF2.** `PrivatePreview:PassphraseHash` holds `pbkdf2-sha256$600000$<salt>$<hash>`, made by `faithtech-community wall-hash` from standard input. Verification is constant-time and always runs the hash, so every refusal (wrong, empty, too long, forged form) is the same response in the same time.
- **The unlock is an HMAC-signed token in a parent-domain cookie.** `__Secure-unlock` holds `w1.<expiry>.<HMAC-SHA256>` for 7 days, `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=faithtech.community`, so one unlock covers `www` and `app`: the two hosts are one site (ADR 0018), and the marketing page's credentialed calls to the community API need the cookie too. Revoking every unlock means rotating `PrivatePreview:SigningKey` (`wall-key`). Data Protection was not used: its key ring is not persisted yet, and a dedicated key makes revocation an explicit owner action.
- **Lockout in memory, one replica.** Five failures from one address in 15 minutes pause that address for 1 minute, doubling to 60; 100 failures overall pause everyone for 15 minutes, doubling to 4 hours. The state lives in the process, so the container app runs one replica while the wall is on. The client address is the ingress's `X-Forwarded-For` entry (`ASPNETCORE_FORWARDEDHEADERS_ENABLED`).
- **CSRF without the framework.** The wall page sets a random `__Host-wall` cookie (host-only, `SameSite=Strict`) and echoes it in the form; the submit must also come from this origin: an `Origin` of this host, or a null or missing `Origin` with `Sec-Fetch-Site` `same-origin` or absent, because under `Referrer-Policy: no-referrer` browsers post a same-origin form with `Origin: null`. ASP.NET Core antiforgery was not used because its cookie names identify the framework.
- **Neutral responses.** Locked navigations get 403 and the wall page; everything else gets an empty 403; nothing redirects. Paths and cookie names (`/__wall/unlock`, `__Secure-unlock`, `__Host-wall`) are neutral; Kestrel's `Server` header is off; `X-Robots-Tag: noindex, nofollow` and a disallow-all `robots.txt` go out on every response while the wall is on.
- **Default on.** `PrivatePreview:Enabled` defaults to `true` and only `appsettings.Development.json` sets it to `false`; with it on, the API refuses to start without a readable hash and key. Lifting the wall is setting it to `false`.
- **The apps keep a strict script policy.** HTML from either build gets `script-src 'self'` and no inline scripts. Angular's critical-CSS inlining loads the full stylesheet through an inline `onload` handler, so the production builds turn it off rather than allowing inline script.
- **Azure Container Apps, Bicep and GitHub Actions.** `eng/infra/main.bicep` declares the environment, registry, Key Vault (every secret), PostgreSQL flexible server, Storage, the API container app with both custom domains on managed certificates, and two Container Apps jobs that run the Cli (`migrate`, `seed`). `eng/deploy.sh`, run by `.github/workflows/deploy.yml`, builds and pushes both images, runs `migrate` and `seed` through the jobs, then rolls out the API, which never migrates itself.

## Consequences

- `AGENTS.md` lists `Application/PrivatePreview/`; `backend/deploy/` and `eng/infra/` gain their first files.
- Existing API tests run with the wall off (as Development does); the wall's own tests turn it on. The Playwright suite runs pre-unlocked through a fixture and locks the wall only in its own specs.
- The wall page must be kept in step with `docs/design-system/patterns/private-preview-wall.html` by hand.
- Scaling past one replica needs the lockout state (and the Data Protection key ring) moved to shared storage first.
- The owner provisions Azure, creates DNS records and sets the secrets (`docs/detailed-designs/platform/private-preview-wall/runbook.md`).
