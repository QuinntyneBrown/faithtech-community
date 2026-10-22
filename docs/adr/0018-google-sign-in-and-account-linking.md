# 0018. Google sign-in and account linking

- Status: Accepted
- Date: 2026-10-22
- Requirements: L1-001, L2-071, L2-072
- Designs: `docs/detailed-designs/identity/google-sign-in`

## Context

The marketing page offers "Sign in with Google" as one button for both sign-in and sign-up. Accounts today are email and password only, with ASP.NET Identity and OpenIddict. The rules that matter are: never create a role, refuse suspended accounts with the same message as password sign-in, link to an existing account only by a verified matching email, validate the Google token on the server, use `state` and a nonce, and keep the client id and secret out of the repository.

## Decision

- **Server-side authorization code flow with OpenID Connect.** `GET /api/account/google/start` creates a random `state` and nonce, stores them with the return URL in a short-lived, data-protected, `HttpOnly`, `Secure`, `SameSite=Lax` correlation cookie (`ftc.google`, 10 minutes), and redirects to Google. `GET /api/account/google/callback` deletes the cookie, refuses a missing or mismatched `state`, and asks `IGoogleIdentityProvider` to exchange the code (with the client secret) and validate the ID token. Both endpoints sit in the rate-limited `/api/account` group and are anonymous by explicit opt-in.
- **Token validation in Infrastructure.** `GoogleIdentityProvider` validates the ID token's signature against Google's published keys, the issuer (`https://accounts.google.com` or `accounts.google.com`), the audience (`Google:ClientId`), the expiry (against `TimeProvider`) and the nonce. Tests replace the provider with a fake; the validator is tested with a local key.
- **Rules in Application.** `GoogleSignInHandler` refuses an unverified Google email; finds the account by its Google login (`AspNetUserLogins`, provider `Google`, key = the `sub` claim), otherwise by the verified email; links the Google login to a matching account; or creates a new account with a profile, no role, a confirmed email and no password. Suspension is checked with the same `AccountStatus.IsSuspendedAsync` rule the password sign-in uses, and returns the same `suspended` outcome and message.
- **Pre-registered accounts.** If the matching local account has never verified its email, nobody has proven they own that address except the Google account holder. Linking confirms the email and removes the unproven password, so whoever created the account cannot sign in with it. The email-verified side effects run as they would after a verification link (private contacts are matched, L2-015).
- **Lockout is a password rule.** A password lockout does not block Google sign-in, which does not guess passwords.
- **Outcomes return to the right app.** Success signs in the short-lived `ftc.session` cookie and redirects to `<WebApp:Origin>/auth/continue`, which completes PKCE (ADR 0017). Failure redirects to `<Marketing:Origin>/?google=failed` or `?google=suspended`; the reason is never more specific than the password path's, so neither path tells a caller more about an account than the other.
- **No schema change.** `CommunityUser` derives from `IdentityUser<Guid>` and the `AspNetUserLogins` table already exists, so no migration is needed.
- **Configuration.** `Google:ClientId` and `Google:ClientSecret` come from configuration or environment variables (`Google__ClientId`, `Google__ClientSecret`). When they are missing the start endpoint returns the visitor to the marketing page with `?google=failed`.

## Consequences

- Microsoft and Apple sign-in are deferred; a second provider would add its own `IExternalIdentityProvider` without changing the handler's linking rule.
- The Google button on the community app's own sign-in page is deferred.
- The e2e fake plays Google too (`accounts.google.com` is routed), so the suite never reaches the network.
