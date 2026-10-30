# 0032. Multi-tenancy: one organisation per host, global accounts, one profile per organisation

- Status: Accepted
- Date: 2026-10-30
- Requirements: L1-025, L1-029, L2-130 to L2-134, L2-148 to L2-150, L2-039, L2-003 AC4
- Designs: `docs/detailed-designs/organisations/tenancy-and-host-resolution`, `docs/detailed-designs/organisations/accounts-and-memberships`, `docs/detailed-designs/organisations/platform-operations`
- Proposal: `docs/proposals/organisations.md`
- Refines: ADR 0006 (invites), ADR 0018 (marketing hand-off), ADR 0021 (connect links), ADR 0026 (private-preview wall)

## Context

The product was built for one organisation: every table is global, "FaithTech" is in the copy, and there is one host for the app and one for the marketing page. The proposal makes it a platform that hosts many organisations in one deployment. Three questions decide everything else: what owns the data, how a request finds its organisation, and how an account relates to an organisation.

## Decision

- **An organisation owns everything.** `Organisation` is a Domain aggregate (`Domain/Organisations/`) with slug, host, name, short name, status (Provisioning, Active, Suspended) and chapter label. Every other aggregate root carries `OrganisationId`. `CommunityDbContext` applies a global query filter on `ICurrentOrganisation` to every scoped entity, the way the archived filter works today, so a handler cannot forget it. Every unique index and every blob path starts with the organisation. Search, SignalR groups, notifications, email sender names and the audit log are scoped. An id from another organisation is simply not found (404, `L2-042` AC2).
- **Identity stays global.** `AspNetUsers`, lockout, Google logins and the OpenIddict tables are not scoped. One identity server issues tokens for every organisation host; each host is a redirect URI of the one `web` client (ADR 0018 keeps a single client).
- **The host resolves the organisation.** `OrganisationResolutionMiddleware` sits in `Program.cs` after `PrivatePreviewGateMiddleware` (ADR 0026) and before authentication, static files and routing. It maps the request host to an organisation and sets `ICurrentOrganisation`. An unknown host, or a suspended organisation, is answered with a neutral page before anything else runs. In Development, `Platform:DefaultOrganisationSlug` names the organisation that `localhost` resolves to. A token never names an organisation; `CurrentRolesMiddleware` loads the caller's profile *in the current organisation* on every request, and a caller without one is refused with the "not a member" page (API: 403).
- **One profile per organisation.** `Profile.OrganisationId` makes the profile the membership. An account has at most one profile per organisation and may have profiles in several. Everything keyed by profile (roles, photos, home chapter, contacts, partner ownership, resources, notes, workspace membership, notifications, announcement opt-out, invites sent, connect link) is therefore per organisation with no further change. Sign-up on a host, an invite and a connect link all create the profile in that host's organisation. `GET /api/me` lists the account's other memberships, and the account menu links to their hosts.
- **Suspension is per membership.** An administrator suspends a profile; that revokes the organisation's sessions for the account and refuses sign-in on that host. A platform operator can lock the account everywhere.
- **Platform operators** are outside every organisation. They provision, suspend and lift organisations and read a platform audit log that lives outside any organisation. They cannot read organisation data; an operator who needs to act inside an organisation is invited by its administrator like anyone else.
- **The wall and the marketing page.** The private-preview wall stays one platform-wide passphrase and cookie. The marketing application is one build served on each organisation's `www` host; name, short name and brochure come from configuration keyed by host, and the hand-off goes to that organisation's community host.

Rejected: a path prefix per organisation (breaks the wall, cookie, CORS, public event and connect link designs and leaks slugs into shareable URLs); a database per organisation (the Cli, migrations, seeding and the in-memory test fixtures all assume one database); one global profile with membership rows (every ownership and visibility rule would need rewriting).

## Consequences

- Every existing design that loads or lists data gains `ICurrentOrganisation`, usually only in its class diagram, because the query filter does the work.
- Migrations: an `Organisations` table, `OrganisationId` on every scoped table backfilled to FaithTech, unique indexes recreated with the organisation prefix, and `AspNetUsers.ProfileId` replaced by `Profiles.UserId` plus a unique index on (`OrganisationId`, `UserId`).
- The e2e fake answers one organisation per host; a spec that needs two organisations seeds both and switches host.
- Infrastructure: one custom host per organisation on the container app, with certificates; automation is deferred.
