# 0006. Invite tokens and acceptance

- Status: Accepted
- Date: 2026-10-21
- Requirements: L2-002 AC3, L2-009, L2-010, L2-011, L2-041 AC1
- Designs: `docs/detailed-designs/invites/send-invite`, `docs/detailed-designs/invites/accept-invite`

## Context

An invite link must be single-use, expire after 14 days and grant an optional pre-assigned role. Several behaviours were left open in the designs: the token format, who sees which invites, an email mismatch on acceptance, whether an invite's role grant is audited, and what "Resend" creates.

## Decision

- The token is 32 random bytes, base64url-encoded, sent only in the email link `{web app}/accept-invite/{token}`. The database stores its SHA-256 hash (`Invite.TokenHash`), so a database read cannot be replayed as a link.
- Any lead (City, Event, Create or Communications Lead) or System Admin may send invites, once their own email is verified (L2-002 AC3: `403` "Verify your email before sending invites."). Only roles the sender may grant under L2-009 can be pre-assigned; other leads may send invites without a role.
- The limit is 50 invites per sender in any 24 hours, counted from the `Invites` table; the 51st answers `429` "You’ve sent 50 invites in the last 24 hours. Try again tomorrow."
- `GET /api/invites` lists every invite from every lead, newest first, to any lead or System Admin (L2-010 AC4).
- Resend applies to an expired invite and creates a new `Invite` (new token, new 14 days) for the same email, role and note, sent by the caller and counted against their limit. The expired invite is kept as history.
- `GET /api/invites/by-token/{token}` is anonymous and returns the invite's status, email, inviter name and city, pre-assigned role and whether an account already uses the email.
- `POST /api/invites/accept` is anonymous. With a name and password it creates a verified account for the invited email (`409` when that email already has an account). Without them the caller must be signed in, and their account email must equal the invited email (`409` "This invite is for another email"); a different address cannot take a role meant for someone else.
- The pre-assigned role is granted in the same unit of work as marking the invite accepted, and it is audited as `role.granted` with the inviter as actor, because every role change is audited (L2-041 AC1). The inviter gets an `InviteAccepted` in-app notification.
- Expired, revoked and used invites all answer the lookup with their status; the page shows a matching error with a link to sign up.

## Consequences

- Losing the email loses the link; the lead resends instead of looking it up.
- Acceptance does not sign the new member in. The page signs them in with the password they just chose, through the normal sign-in flow.
