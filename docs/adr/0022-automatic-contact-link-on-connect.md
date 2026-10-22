# 0022. Automatic contact link on connect, beside L2-015's confirm step

- Status: Accepted
- Date: 2026-10-22
- Requirements: L2-084, L2-015, L2-012, L2-027, L2-028
- Designs: `docs/detailed-designs/contacts/link-contact-on-sign-up`, `docs/detailed-designs/invites/connect-by-qr-code`

## Context

`L2-015` asks the lead to confirm "Link contact" when one of their private contacts signs up, because the match is only by email and the person never asked to be anyone's contact. A person who scans a City Lead's QR code has asked: the connect page says that connecting adds them to the lead's contacts. Questions: does the lead still confirm, what if a contact with that email already exists, and how does the connection survive until the email is verified.

## Decision

- Connecting through a lead's link **links without the lead confirming**. `ContactConnector.ConnectAsync(lead, profile)`:
  - does nothing if the lead already has a contact linked to that profile;
  - otherwise links the lead's **unlinked contact with the same email** (case-insensitive), restoring it if archived and keeping its notes, rather than creating a second one;
  - otherwise creates a contact owned by the lead with the profile name and account email, linked to the profile.
- A new link notifies the lead with the existing `ContactSignedUp` kind, worded "{name} connected with you", in-app and by email, in the same unit of work (`L2-028`).
- The **connecting lead is attached as a `PendingConnection`** row (profile, lead), not as a field on `EmailVerified`: the lead must be remembered between sign-up and the click on the verification link, possibly days later and in another browser. `ContactSignedUpHandler`, which every verification path already calls, connects and removes the pending rows first, then runs the `L2-015` match for other leads, which no longer sees the contact just linked. `EmailVerified` is unchanged.
- A signed-in member with a verified email is connected at once; with an unverified email the connection waits as a pending row.
- Contacts created this way are ordinary contacts: private to the owner and System Admin through `ContactAccess` (ADR 0014), with System Admin access audited.
- Opening the lead's own link connects nothing.

## Consequences

- Leads may receive contacts they did not type in; that is the point of the code. Removing one is the existing archive and delete.
- Other leads holding the same email still get the confirm flow, so `L2-015` is unchanged for them.
- A pending connection for an account that is never verified stays in the table; it is harmless and is not cleaned up in v1.
