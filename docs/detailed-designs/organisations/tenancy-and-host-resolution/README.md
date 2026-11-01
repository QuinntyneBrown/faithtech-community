# Tenancy and host resolution

## Overview

FaithTech Community was built for one organisation: every table is global, "FaithTech" is in the copy and the email footer, and one host serves the app (ADR 0018, ADR 0026). The organisations subsystem makes the product a platform: one deployment hosts many organisations, and FaithTech is the first one, provisioned by seed so that nothing it does today changes (`docs/proposals/organisations.md`, ADR 0032). This design covers the foundation the rest of the subsystem stands on: the organisation record, how a request finds its organisation, and how every record, query, file, message and audit entry stays inside it.

- **organisation** — tenant of the platform: a named community with its own host, members, roles, chapters, taxonomies, data and audit log
- **slug** — short lower-case identifier of an organisation, 3 to 40 letters, digits and hyphens, unique across the platform
- **community host** — host name that serves an organisation's community app, API and identity server, for example `app.faithtech.community`; unique across the platform
- **public host** — host name that serves an organisation's marketing page, for example `www.faithtech.community`; configured per host, with FaithTech's as the default
- **scoped record** — aggregate root other than accounts, external logins and the identity server's own tables; it carries an `OrganisationId` and is visible only inside that organisation
- **current organisation** — organisation the request host resolves to, exposed to the rest of the request as `ICurrentOrganisation`
- **neutral page** — server-rendered page that names no organisation and no product, in the manner of the private-preview wall page: the unknown-host page (404) and the suspended page (503)

The host decides the organisation, nothing else does. A token, a header, a cookie, a query string or a body that names an organisation is ignored (`L2-131` AC5). Accounts are global and are not scoped; a member's profile is their membership of one organisation (`docs/detailed-designs/organisations/accounts-and-memberships`). Provisioning, suspension and the platform operators are in `docs/detailed-designs/organisations/platform-operations`. The private-preview wall stays platform-wide: one passphrase, one cookie domain, in front of every host (ADR 0026).

## Description

### Domain — `Organisations/`

- **`Organisation`** — aggregate root in `FaithTech.Community.Domain/Organisations/`. Fields: `Id`, `Slug`, `Host` (the community host), `Name` (up to 100 characters), `ShortName` (up to 30 characters), `ChapterLabelSingular` and `ChapterLabelPlural` (both null when the organisation has no chapters, ADR 0034), `Status`, `SuspendedReason`, `SuspendedAtUtc` and `CreatedAtUtc`. Methods: `Rename(name, shortName)` and `SetChapterLabel(singular, plural)` (used by the organisation settings design), `Suspend(reason, nowUtc)` and `Lift()` (used by platform operations). `Suspend` on a suspended organisation and `Lift` on an active one throw, as `Profile.Suspend` and `Profile.Reinstate` do today.
- **`OrganisationStatus`** — enumeration `Provisioning`, `Active`, `Suspended`. `Provisioning` is held only while `ProvisionOrganisationHandler` writes the organisation's defaults in one unit of work; a request never sees it.
- **`IOrganisationScoped`** — interface with one property, `Guid OrganisationId`, implemented by every record that has a table of its own and is queried directly: `Profile`, `Invite`, `ConnectLink`, `PendingConnection`, `Contact`, `ContactNote`, `Partner`, `PartnerStageChange`, `PartnerActivity`, `PartnerDuplicateDismissal`, `Event`, `Announcement`, `Notification`, `Resource`, `ResourceBlobTask`, `NotePage`, `NoteLink`, `NoteImage`, `Workspace`, `WorkItem`, `Sprint`, `PokerSession`, `PhotoBlobTask`, `AuditEntry`, the outbox email (`OutboxMessage`), and later `RoleDefinition`, `Chapter`, the three taxonomy lists and `OrganisationAdminRoster`. Owned children (photos, RSVPs, tags, share lists, comments, votes) reach their organisation through their parent and are not stamped. Accounts, external logins, `VerificationResend` (keyed by an account's email) and the identity server's tables are global. `SystemAdminRoster` stays a global singleton until slice 13 replaces it with `OrganisationAdminRoster`.

### Application — `Organisations/`

- **`ICurrentOrganisation`** — abstraction in `FaithTech.Community.Application/Organisations/` exposing `Id`, `Slug`, `Name`, `ShortName`, `Host`, `Origin` (`https://{Host}`; in Development, `WebApp:Origin` stands in for the default organisation so that email links keep working on `localhost`), `ChapterLabel` (singular and plural, or null) and `Status`. Handlers read it the way they read `ICurrentUser` today. Every handler that composes copy, an email, an `.ics` file or a link reads the name, short name and origin from it, never from a constant (`L2-134`).
- **`IOrganisationResolver`** — `ResolveByHostAsync(host)` returns the organisation whose `Host` equals the request host, case-insensitively, or null. Infrastructure implements it over the unique `Host` index with one indexed query per request. A cache is deferred, because a suspension shall take effect on the next request (`L2-150` AC1).
- **`OrganisationScope`** — the one scoped realisation of `ICurrentOrganisation`, registered by Infrastructure. `OrganisationResolutionMiddleware` calls `Set(organisation)` from the host; SignalR hub calls get it from `OrganisationHubFilter`, which copies the organisation the connection's request resolved; `OrganisationWork.ForEachAsync` runs the email outbox, the photo retry worker and the resource maintenance worker once per organisation, each in a scope of its own after `RunAs(organisationId)`; the Cli works in FaithTech. Reading it before it is set throws, so nothing runs against no organisation or a guessed one. (Slice 02 replaced the planned `HttpCurrentOrganisation` with this single scope, because one DI registration has to serve requests, hub calls and workers.)
- **`PlatformOptions`** — section `Platform`: `DefaultOrganisationSlug` (Development only: the organisation that `localhost` resolves to, `L2-131` AC4) and `Operators` (platform operations). The API validates on start that the slug is well-formed when it is set.
- **`MarketingSite`** — `MarketingOptions.Sites` (section `Marketing:Sites`) maps each public host to one entry: `OrganisationSlug`, `Headline`, `BrochureUrl` with `BrochurePosterUrl`, `BrochureCaptionsUrl`, `BrochureTitle` and `BrochurePosterAlt`, and `Footer`. `Marketing:Origin` keeps its meaning as FaithTech's public host; its content is `Marketing:DefaultSite`, which belongs to `Platform:DefaultOrganisationSlug` unless it names another slug. A public host with no entry, or whose organisation does not exist, is an unknown host (`L2-134` AC3).

### Infrastructure — `Persistence/`, `Storage/`, `Search/`, `Email/`, `Calendar/`, `Admin/`

- **Global query filter** — `CommunityDbContext` takes `ICurrentOrganisation` through its constructor and, in `OnModelCreating`, gives every `IOrganisationScoped` entity a required, indexed `OrganisationId` with a restricting foreign key to `Organisations`, and the named query filter `QueryFilters.Organisation` (`e => e.OrganisationId == CurrentOrganisationId`). EF Core 10 keeps named filters side by side, so the archived filter on `Workspace` and `WorkItem` is named `QueryFilters.Archived` and the queries that showed archived records now call `IgnoreQueryFilters(QueryFilters.ArchivedOnly)`, which keeps the organisation's filter. A context built with options alone (design-time tooling, tests that open the database directly) works as FaithTech. Every list, search, export, notification, SignalR group, report and load by id therefore runs its organisation predicate in SQL (`L2-130` AC2), and an id from another organisation is not found, which the `NotFoundOrForbidden` convention already turns into 404 (`L2-130` AC3, `L2-042` AC2). No query lifts the organisation's filter, except `OrganisationWork` listing the organisations themselves, which are not scoped.
- **Stamping on save** — `CommunityDbContext.SaveChangesAsync` sets `OrganisationId` on every added `IOrganisationScoped` entity from `ICurrentOrganisation` and throws when an entity arrives with a different value, so no request can set another organisation (`L2-130` AC1). `OrganisationId` has no public setter in the Domain.
- **Unique indexes** — every unique index starts with `OrganisationId`: profile per account (`Profiles (OrganisationId, UserId)`), connect link per owner, one pending connection, chapter name, role definition name, taxonomy keys and the rest that are unique today (`L2-130` AC4). `Organisations.Slug` and `Organisations.Host` are unique across the platform.
- **Blob paths** — the handlers that mint a key (profile photo upload, contact photo upload, resource file store, note image) start it with `{organisationId}/`; the storage adapters store whatever key the record holds. A photo or file URL is issued by the API on the organisation's host for a record found through the filtered context, so a file is reachable only through its own organisation (`L2-130` AC5).
- **Search** — `PostgresFullTextSearch` queries the filtered DbSets, so the organisation predicate joins the permission filters in the same SQL.
- **SignalR** — `AgileHub.BoardGroup` and `PokerGroup` names start with the organisation id (`{organisationId}:board:{workspaceId}`), and a connection joins a group only after the workspace or session is found through the filtered context.
- **Email** — the outbox row carries `OrganisationId`; `OutboxEmailQueue` sets `OrganisationScope` from it before `EmailTemplateRenderer` runs. The sender display name is the organisation's name over the platform's `Smtp:From` address, the subject prefix and the footer carry the name, the action button reads "Open in {short name}" instead of the constant `ActionLabel`, and every link, the unsubscribe link included, is built on `ICurrentOrganisation.Origin` (`L2-130` AC6, `L2-134` AC5).
- **`.ics`** — `IcsCalendarWriter` writes `PRODID:-//{organisation name}//Events//EN` and the organisation's name as the organiser (`L2-134` AC4).
- **Audit** — `AuditEntry` implements `IOrganisationScoped`; `AuditLog.Record` stamps it like every other row, and the audit page lists only the current organisation's entries (`L2-130` AC7). Platform operator actions never reach this log (`L2-152` AC4).
- **Migration** — adds `Organisations`, seeds the FaithTech row, adds `OrganisationId` to every scoped table backfilled to FaithTech, recreates the unique indexes with the organisation prefix, and moves the account link from `AspNetUsers.ProfileId` to `Profiles.UserId` (ADR 0032).

### Api — `Middleware/Organisations/`

- **`OrganisationResolutionMiddleware`** — added in `Program.cs` after `app.UsePrivatePreview()`, `app.UseExceptionHandler()` and `app.UseStatusCodePages()`, and before `app.UseStaticSites`, `app.UseCors`, `app.UseAuthentication` and routing, so an unresolved host reaches no static file, no endpoint, no hub and no identity endpoint (`L2-131` AC1). It:
  - passes `GET /health/live` through, as the wall does (`L2-131` AC2);
  - in Development, treats `localhost` as the organisation named by `Platform:DefaultOrganisationSlug` (`L2-131` AC4);
  - looks the host up as a public host in `Marketing:Sites`, then as a community host through `IOrganisationResolver`;
  - for no match, answers 404: the unknown-host page for a navigation (`GET` or `HEAD` accepting `text/html`), an empty body for anything else, with `Cache-Control: no-store`; nothing is logged beyond the request log (`L2-131` AC2);
  - for a suspended organisation, answers 503 in the same two forms with the suspended page (`L2-131` AC3, `L2-150` AC1);
  - otherwise stores the organisation and the host kind (community or public) in `HttpContext.Items` and calls the next middleware.
- **`HttpCurrentOrganisation`** — realises `ICurrentOrganisation` from `HttpContext.Items`, as `HttpCurrentUser` realises `ICurrentUser`.
- **`SystemPages`** — renders `unknown-host.html` and `suspended.html`, embedded resources that follow `WallPage`: the design system's auth layout and card rules inline under the neutral accent, a per-response CSP nonce, no app bundle and no product name (ADR 0026 records why these pages are not Angular). The e2e fake renders the same files.
- **CORS** — `WebProtectionSetup` replaces the fixed origin list with `SetIsOriginAllowed`: the current organisation's `Origin` and the origins of the public hosts whose `Marketing:Sites` entry names its slug, with credentials (`L2-131` AC6). While the private-preview wall is up, `PrivatePreviewGateMiddleware` lets through preflights from every configured public host, so each organisation's policy judges them.
- **Static sites** — `StaticSitesSetup` chooses the community build when the host kind is community and the marketing build when it is public, instead of comparing against `WebApp:Origin` and `Marketing:Origin`. The apps' `connect-src` names the community origin of the host's own organisation.
- **`GET /api/site`** — anonymous endpoint in `SiteEndpoints`, served on both host kinds: `name`, `shortName`, `chapterLabel`, `communityOrigin` and, on a public host, the entry's `headline`, `brochure` (`url`, `posterUrl`, `captionsUrl`, `title`, `posterAlt`; null when the entry has no `BrochureUrl`) and `footer`; on a community host those three are null. Pages that render before sign-in (the marketing page, sign-in, sign-up, the public event page, invite acceptance) take the organisation's name from it; signed-in pages take it from `/api/me` (`L2-133` AC1).

### Frontend — `api`, app shell, `marketing`

- **`SiteService`** — contract and `SITE_SERVICE` token in `frontend/projects/api/`, implemented by `HttpSiteService` over `GET /api/site`, exposing `site: Signal<Site | null>`. Both applications load it on start.
- **App shell** — the top bar shows the organisation's short name as the product name; `OrganisationTitleStrategy`, an Angular `TitleStrategy` registered in `app.config.ts`, sets the document title to "{page} · {short name}" (`L2-133` AC2, `L2-134` AC2). Copy that names the product reads the name or short name from `AuthService.currentUser().organisation` or `SiteService.site()`: "We couldn't reach {short name}", "Join {name}", "{name} headline", "Hosted by {name}" (`L2-134` AC1).
- **Marketing application** — one build for every public host. Before it starts, `main.ts` reads `GET /api/site` from its own origin with `fetchSite` from `api`, and `marketingConfig(site)` provides `COMMUNITY_ORIGIN` and `provideApi` from the response's `communityOrigin`, which replaces the build-time value of ADR 0018 (the build-time value stays only as the fallback when the site cannot be read), and `SITE_SERVICE` through `provideLoadedSite`; the headline, name, brochure video and footer come from the same response (`L2-134` AC3). The hand-off to `/auth/continue` on the community host is unchanged.

### Open questions

- **Decided (slice 01): loopback hosts.** `L2-131` AC4's `localhost` rule covers every loopback name (`localhost`, `*.localhost`, `127.0.0.1`, `::1`) and applies in the Development environment and in the API test host's `Testing` environment, so the compose smoke test (`app.localhost:8080`) and every existing test keep resolving to the default organisation. In any other environment a loopback host is an unknown host.
- **Decided (slice 01): default slug.** `Platform:DefaultOrganisationSlug` defaults to `faithtech` and is validated on start as a slug. Until slice 05 configures public hosts in `Marketing:Sites`, the host of `Marketing:Origin` is the default organisation's public host.
- **Decided (slice 01): no body from status code pages.** The middleware sits after `UseStatusCodePages`, so it turns status code pages off for its own 404 and 503, keeping the non-navigation answer an empty body.
- **Decided (slice 04): the subject prefix is the product name each subject already carries.** No subject had a prefix before, so instead of adding one (which would change every FaithTech subject) each subject that named "FaithTech Community" now names the organisation; FaithTech's subjects read as before. The sender display name is the organisation's name over the address of `Smtp:From`, handed to the transport as `EmailMessage.FromName` by the outbox dispatcher, which runs with the organisation in scope; no column was added.
- **Decided (slice 04): one source of names in the frontend.** `OrganisationNames` in `api` reads `/api/me`'s organisation when signed in, otherwise `SiteService.site()`; the `components` library declares an `ORGANISATION_NAMES` token that the community app provides from `OrganisationNames`, so library components (top bar, logo mark, sign-in form, role dialog, picture list) name the organisation without depending on `api`. When neither response could be read the copy says "Community"; nothing falls back to a fixed organisation. Copy keeps its existing wording with the short name in place of "FaithTech" (for example "Join {short name}", "Hosted by {short name} {city}"), so FaithTech reads exactly as before. The `.ics` `UID` domain (`@faithtech.community`) is an identifier, not copy, and stays so calendars keep matching events.
- **Decided (slice 05): the brochure is five fields, not one URL.** The brochure video needs its poster, captions, accessible name and poster description as well as the file, and FaithTech's must read as before, so the entry carries `BrochureUrl` plus four companions rather than deriving them from the URL; a host without `BrochureUrl` shows no video. The headline falls back to the organisation's name and the footer to its name when an entry has none.
- **Decided (slice 05): the marketing page's other copy stays product copy.** The lead, the three benefits and the call to action do not name an organisation, so they stay in the template; making them per-host content waits for organisation-level branding.
- **Decided (slice 29, was deferred from slice 05): Google sign-in per organisation host.** `GoogleOrigins` (`Api/Authentication/`) takes the request host's organisation. Its callback is `{community origin}/api/account/google/callback`, and success lands on `{community origin}/auth/continue`. A failure returns to the organisation's first public origin in `Marketing:Sites` with `?google=failed|suspended`, or to `{community origin}/sign-in` when it has none. The default organisation keeps `WebApp:Origin` and `Marketing:Origin`, so FaithTech's flow is unchanged (`L2-078`). The marketing page already starts the flow on `site.communityOrigin`, so the correlation cookie and the callback share a host. The private-preview wall's own preflight list keeps `WebApp:Origin`.
- **Deferred from slice 04.** The marketing application's copy and its `/api/site` load (slice 05); the Staff role's description in `api/shared/role.ts`, which became role-definition data (slices 10 and 16; `role.ts` holds no role data since slice 29); the brand mark artwork, which stays FaithTech's until organisations can set a logo.
- **Decided (slice 03): existing blobs stay where they are.** New keys get the `{organisationId}/` prefix; a record stores its own key, so FaithTech's existing unprefixed blobs stay readable through their records and no blob is moved. A file is still reached only through a record found through the filtered context.
- **Decided (slice 02): unique rules per organisation.** Every unique index on a scoped table now leads with `OrganisationId` (pending connection, connect link owner and token, invite token, partner duplicate dismissal). The EF Core in-memory provider the backend tests use does not enforce unique indexes, so the per-organisation rule is checked by the migration's SQL, not by a test.
- **Decided (slice 01): hosts in lower case.** `Organisation` stores its host in lower case and the resolver lowers the request host, so a plain unique index makes hosts unique case-insensitively without a database collation.
- Caching the organisation row in the API process, invalidated on suspend and lift, is deferred; v1 runs one indexed query per request.
- Deferred: where a brochure video is stored once an organisation other than FaithTech supplies one waits on organisation-level branding (the proposal's Deferred list); `BrochureUrl` is a URL in configuration until then.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines a level-1 (L1) requirement, cited by identifier. Error pages (`L2-048`), server authorization (`L2-042`), the wall (`L2-101`) and the marketing page (`L2-074`) are referenced, not repeated.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-130` | `L1-025`, `L1-015` | Organisation record and isolation |
| `L2-131` | `L1-025`, `L1-018` | Resolving the organisation from the host |
| `L2-134` | `L1-025` | Organisation name in copy and email |

### Acceptance criteria

**`L2-130` — Organisation record and isolation**

Every record belongs to exactly one organisation (ADR 0032). "Scoped" below means every aggregate except accounts, external logins and the identity server's own tables.

1. Given any scoped record, when it is created, then it is stamped with the current organisation, and no request can set a different one.
2. Given a list, search, export, notification, SignalR group or report, when it is built, then the organisation filter is applied in the database query through the context's global filter, not after loading the data (`L2-042` AC3).
3. Given a record id that belongs to another organisation, when it is requested by id, by link, by `.ics`, by public event page, by connect link, by invite token or by share, then the response is 404 or the "unknown" outcome the feature already uses, never the record (`L2-042` AC2).
4. Given a unique rule in any feature (one connect link per owner, one pending connection, unique chapter name, unique role name), when it is enforced, then it is unique within the organisation only, so two organisations may each hold the same value.
5. Given an uploaded file (photo, contact photo, resource, note image), when it is stored, then its blob path starts with the organisation's id, and it is served only on that organisation's host.
6. Given an email the system sends, when it is composed, then its sender display name, subject prefix, footer and links use the organisation's name and host, and the unsubscribe link (`L2-028`) works on that host.
7. Given the audit log, when any entry is written, then it belongs to the organisation and is listed only on that organisation's audit page (`L2-041`).

**`L2-131` — Resolving the organisation from the host**

1. Given a request on a host that maps to an active organisation, when `OrganisationResolutionMiddleware` runs (after the private-preview wall and before authentication, static files and routing), then the organisation is the current one for the rest of the request.
2. Given a request on a host that maps to no organisation, when it is received, then every path answers 404 with the neutral unknown-host page (`L2-048`), which names no organisation and nothing is logged beyond the request log; `/health/live` still answers.
3. Given a request on the host of a suspended organisation (`L2-150`), when it is received, then every path answers 503 with the neutral suspended page, and no sign-in, API call or static file of the apps is served.
4. Given Development, when the host is `localhost`, then the organisation named by `Platform:DefaultOrganisationSlug` is current.
5. Given a token, header, cookie, query string or body that names an organisation, when it arrives, then it is ignored: only the host decides.
6. Given CORS, when a preflight or request carries an `Origin`, then only the current organisation's community and public origins are allowed, with credentials (`L2-101` AC3, ADR 0018).

**`L2-134` — Organisation name in copy and email**

1. Given any page, dialog, toast, empty state, error message, email subject or email body that names the product, when it renders, then it uses the organisation's name or short name from `/api/me` or the organisation record, never a fixed name ("We couldn't reach {short name}", "Join {name}", "{name} headline", "Hosted by {name}" on public event pages).
2. Given the HTML document title, when any route renders, then it is "{page} · {organisation short name}".
3. Given the public marketing page (`L2-074`), when it is served on an organisation's public host, then its headline, name, brochure video and footer come from the configuration entry for that host; a public host with no entry shows the unknown-host page.
4. Given the `.ics` download (`L2-024`), when it is generated, then `PRODID` and the organiser name carry the organisation's name.
5. Given the invite, announcement, notification and verification emails, when they are rendered, then "{organisation name}" replaces every product name and the links point at the organisation's community host.

## Diagrams

### System context

Members and visitors of each organisation reach the platform on that organisation's hosts; DNS points every host at the one deployment, and email leaves under the organisation's name.

![C4 system context for tenancy and host resolution](diagrams/c4-context.png)

### Containers

One API container serves every organisation: it resolves the host, serves the community or marketing build, and reads one database and one blob account whose rows and paths are scoped by organisation.

![C4 container view for tenancy and host resolution](diagrams/c4-container.png)

### Components

The resolution middleware runs after the wall and before static files, CORS and authentication; `ICurrentOrganisation` feeds the context's global filter, the stamping on save, the blob prefix, the hub groups and the email renderer.

![C4 component view for tenancy and host resolution](diagrams/c4-component.png)

### Class structure

`Organisation` holds the status and the labels; `HttpCurrentOrganisation` and `OrganisationScope` both realise `ICurrentOrganisation`, which `CommunityDbContext` reads for its filter and its stamping.

![Class diagram for tenancy and host resolution](diagrams/class-structure.png)

### Behaviour — resolve a request

The middleware answers an unknown host with 404 and a suspended organisation with 503 before anything else runs; an active organisation becomes current, and every later query carries its predicate (`L2-130`, `L2-131`).

![Sequence diagram for resolving a request](diagrams/sequence-resolve-request.png)

### Behaviour — render organisation copy

The shell takes the short name and the title from `/api/me`; an email takes the name, the footer and its links from the organisation the outbox row belongs to (`L2-134`).

![Sequence diagram for rendering organisation copy](diagrams/sequence-render-copy.png)
