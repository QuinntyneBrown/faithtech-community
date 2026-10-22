# 0021. Connect links: a City Lead's reusable QR code

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-080, L2-081, L2-082, L2-083
- Design: `docs/detailed-designs/invites/connect-by-qr-code`

## Context

A City Lead wants to show a QR code to someone they meet so that person can join FaithTech Community and become the lead's contact. An invite (ADR 0006) does not fit: it needs the person's email, works once and expires after 14 days. The code must work for everyone at an event, keep working on printed or shared copies, be retirable if it leaks, and grant nothing beyond joining.

## Decision

- A **connect link** is `{web app}/meet/{token}`. One per owner (`ConnectLink.OwnerId` unique). The token is 32 random bytes, base64url (`InviteTokens.New`), like an invite token.
- The database stores the token's **SHA-256 hash** (`TokenHash`, unique) for lookups, and a copy encrypted with ASP.NET Data Protection under its own purpose (`ProtectedToken`) so the owner sees the same code every time they open "My QR code". The plain token is never stored. A database read alone cannot be replayed as a link, which is the property ADR 0006 wanted from hashing; reading the protected copy also needs the key ring. The prompt asked for the hash only; that cannot show the same code twice, so this is the smallest change that keeps printed codes working.
- The link is **reusable and never expires** (unlike invites, `L2-010` AC1). **Make a new code** replaces the token on the same row; the old hash no longer exists, so the old link answers as unknown at once. People already connected keep their contacts.
- Only **City Leads and System Admins** have a link: `GET`/`POST /api/connect/link` answer `403` to anyone else. Each acts only on the caller's own link; nobody, System Admin included, reads or replaces another lead's link, so there is no admin action to audit.
- A link whose owner is suspended or no longer holds City Lead or System Admin **answers as unknown** until they do again. The row is kept.
- The anonymous endpoints are `POST /api/connect/lookup` and `POST /api/connect/sign-up`, both rate-limited with the auth policy, with the token in the body (`L2-043`). The lookup returns the lead's name, featured photo (a one-hour read URL, ADR 0002), home city and role label; showing them is the lead's choice by sharing the code.
- Sign-up through the link reuses the `L2-001` rules and outcome (`202` whether or not the email exists). A new account records a `PendingConnection` to the lead; nothing is linked until the email is verified (ADR 0022).
- The web route is **`/meet/:token`**, not `/connect/:token`, because the reverse proxy (and the dev proxy) send `/connect/*` to the OpenIddict server.
- The link **grants no role**.

## Consequences

- Losing the Data Protection key ring invalidates every shown code's protected copy; the owner then makes a new code. Lookups still work, since they use the hash.
- One code per lead keeps the dialog simple; codes per event, roles on the link and scan counts are deferred.
- The connect link is not an invite: the invites list and the 50-per-day invite limit do not apply to it.
