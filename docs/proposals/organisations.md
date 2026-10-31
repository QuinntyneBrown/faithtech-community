# Proposal: Organisations

Make the platform organisation-agnostic: one deployment that hosts many organisations, each defining its own roles, chapters and vocabulary as data, with FaithTech as the first organisation.

- Status: agreed; requirements written as `L1-025` to `L1-029` and `L2-130` to `L2-152` in `docs/specs/`, designs in `docs/detailed-designs/organisations/`, ADRs 0032 to 0035. The mocks (`docs/mocks/pages/organisation-*` and the screens they change), the design-system pages, `docs/screen-composition.md` and the estimate (`docs/estimates/organisations.md`, 52 days, 0% complete) are done (prompt `00`). Code follows in the slices.
- Date: 2026-10-30
- Next step: run prompts `01` to `29` in `docs/prompts/` in order (`docs/prompts/README.md`), one acceptance-test-driven slice each.

## Problem

FaithTech Community is built for one organisation. "City Lead", "Staff", "Volunteer", the idea that a member has a home *city*, the partner stages Lead, In Funnel and Confirmed, the five event types and the seven resource types are all code: a Domain enumeration, a policy class, a copy of the rules in the frontend, another copy in the e2e fake, and the same words in every requirement and design. A church network with campuses, a professional association with regional branches, a company with offices, or a club with no subdivisions at all could use everything the product does (profiles, invites, contacts, partners, events, announcements, resources, notes, workspaces, reports), but could not call a chapter a "campus", could not have a "Meet-up Lead", and could not share a deployment with anyone else.

The product should be a platform. An organisation signs up, names itself, decides whether it has chapters and what to call them, defines the roles its people hold and what each role may do, and chooses its own pipeline stages and event types. FaithTech is simply the first organisation, and nothing FaithTech does today changes.

## What we are building

**Organisations** is a new subsystem, named `organisations` everywhere the layout requires one name: `Domain/Organisations/`, `Application/Organisations/`, `frontend/projects/organisations/`, `docs/specs/` (`L1-025` to `L1-029`, areas `ORG`, `ROLE`, `CHAP`, `ORGSET`, `PLAT`), `docs/detailed-designs/organisations/`, `docs/estimates/organisations.md` and `e2e/tests/organisations/`. The navigation section for its settings pages is called **Organisation**.

An **organisation** is a tenant: a named community with its own host, members, roles, chapters, taxonomies, data and audit log. Every record the product stores belongs to exactly one organisation. The platform itself defines what the product *can* do (the capability catalogue, the feature set, the system pages) and an organisation defines what its people *may* do and what things are called.

The repository, the .NET namespaces (`FaithTech.Community.*`) and the npm scope (`@faithtech-community/*`) keep their names. Only copy, seed data and documentation change; renaming the codebase is a separate decision.

## Decisions

Each decision was taken deliberately; rejected alternatives are recorded so they are not re-opened by accident.

### Tenancy and hosts

- **One deployment, many organisations.** Every aggregate root carries an `OrganisationId`. The database applies a global query filter on the current organisation (the same mechanism as the archived filter), every unique index starts with the organisation, blob paths are prefixed `{organisationId}/`, and SignalR groups, search queries, notifications, email sender names and the audit log are scoped. An id from another organisation answers 404, which `L2-042` AC2 already requires for anything the caller may not see. Identity and OpenIddict tables are not scoped: accounts are global (below).
- **The host picks the organisation.** Each organisation has one host (for FaithTech, `app.faithtech.community`; for a new organisation, `{slug}.{platform domain}` or a custom host once DNS points at the platform). `OrganisationResolutionMiddleware` runs after `PrivatePreviewGateMiddleware` and before authentication and routing, resolves the host to an organisation and exposes it as `ICurrentOrganisation`. An unknown host gets a neutral "There's nothing here" page. In Development, `Platform:DefaultOrganisationSlug` names the organisation that `localhost` resolves to. Tokens never name an organisation: the server checks on every request that the account holds an active membership in the host's organisation.

  Rejected: a path prefix (`/acme/events`). The private-preview wall, the unlock cookie, CORS origins, the marketing hand-off (ADR 0018), public event links and connect links are all host-based today; a prefix would break each of them and put the organisation's slug into every shareable URL.
- **The private-preview wall stays platform-wide**: one passphrase, one cookie domain, exactly as ADR 0026 built it. A per-organisation wall is deferred until the first organisation other than FaithTech needs one.
- **The marketing page is served per host.** One build; the organisation's name, short name and brochure video come from configuration keyed by host, with FaithTech's as the default. `www.{organisation host}` shows that organisation's page; the sign-in and sign-up forms hand off to the organisation's community host as they do today.
- **Suspension** moves from the account to the membership: an organisation's administrator suspends a member *of that organisation*, which revokes that organisation's sessions and refuses sign-in on that host. A platform operator can additionally lock an account everywhere. `L2-039` and `L2-003` AC4 are rewritten accordingly.

### Accounts and memberships

- **The account is global; the profile is the membership.** An account (email, password, Google login, lockout) exists once. A member has **one profile per organisation** they belong to: `Profile.OrganisationId`. Everything that hangs off a profile today (roles, photos, home chapter, contacts, partner ownership, resources, notes, workspace membership, notifications, announcement opt-out) therefore stays per organisation without change.

  Rejected: one global profile with a membership row per organisation. Every ownership and visibility rule in the product would have to be re-expressed against memberships, and a FaithTech photo would show up in another organisation.
- Sign-up on an organisation's host creates the account if it is new and a profile in that organisation. An invite or a connect link creates the profile in the inviter's organisation. A verified account that signs in on a host where it has no profile sees "You're not a member of {organisation}" with a sign-out link; joining is by sign-up, invite or connect link, never automatic.
- `GET /api/me` returns the organisation (name, short name, chapter label), the caller's profile, roles, **capabilities**, chapter, and their other memberships (organisation name and host). The account menu gains **Switch organisation** when there is more than one: a list of links to the other hosts. The session carries across because the identity server is one; each organisation host is a redirect URI of the same `web` client.

### Who may do what: capabilities

The platform defines a fixed **capability catalogue**. An organisation never adds a capability; it decides which roles carry which. Baseline rights every member has (view profiles, the team, events and announcements; RSVP; open the resources and notes visible to them; create their own notes; search; edit their own profile and settings) are not capabilities and cannot be taken away.

| Capability | Lets a holder |
|---|---|
| `ManageEvents` | Create, edit and cancel events (`L2-020`, `L2-025`). |
| `ViewAttendees` | See the full RSVP list and the check-in page read-only, without guest emails (`L2-022` AC4, `L2-117` AC2, `L2-121`). |
| `ManageAttendance` | See guest emails, export RSVPs and attendance, check attendees in, undo and add walk-ins (`L2-022` AC4-5, `L2-117` to `L2-122`). |
| `KeepContacts` | Keep private contacts, their notes and photos, and be warned of duplicates (`L2-012` to `L2-016`, `L2-067` to `L2-073`, `L2-116`). |
| `ViewPartners` | Open the partner board, partner pages, timelines and duplicate alerts read-only (`L2-017` AC2, `L2-111`, `L2-113` AC4). |
| `ManagePartners` | Add, edit and move partners, log activities, merge and dismiss duplicates (`L2-017`, `L2-018`, `L2-110`, `L2-112` to `L2-115`). |
| `InviteMembers` | Send and resend invites and see the invites page; a pre-assigned role is limited by the grant rules (`L2-010`). |
| `ConnectLink` | Have a personal reusable QR code at `/meet/{token}` (`L2-080` to `L2-084`). |
| `OwnWorkspaces` | Create and own Agile workspaces and be the target of an owner reassignment (`L2-031` AC1, `L2-037` AC2, `L2-050`). |
| `JoinWorkspaces` | Be added to a workspace as a member (`L2-031` AC2, ADR 0011). |
| `ReadAllWorkspaces` | Open every workspace read-only and watch Planning Poker (`L2-031` AC5, `L2-038` AC7, `L2-050` AC3). |
| `ViewPeopleDirectory` | Open People (`L2-053`). |
| `AssignRoles` | Add and remove roles on other profiles, within the grant rules (`L2-009`, `L2-053` AC2). |
| `SendAnnouncements` | Compose and send announcements (`L2-029`). |
| `AddResources` | Add and own resources and be the target of an ownership transfer (`L2-057`, `L2-064` AC3). |
| `ViewReports` | Open Reports and export it (`L2-123`, `L2-128`). |
| `ManageRoles` | Define roles and grant rules. |
| `ManageOrganisationSettings` | Change the organisation's name, chapter label, chapters, partner stages, event types and resource types. |
| `AdministerOrganisation` | Everything above, plus: override any record, suspend and reinstate members, read the audit log, edit any profile, transfer resource ownership, reassign workspace owners, restore merged partners, move and edit any note (`L1-014`, `L2-039` to `L2-041`, `L2-064`, `L2-098`, `L2-115` AC4). |

- **The server authorises by capability**, never by role name: `ICurrentUser.Has(capability)` replaces `HasRole(role)`, and the capability set is computed from the caller's current roles on every request, so a role or definition change takes effect on the next call (`L2-042` AC4 unchanged in spirit).
- **Override rule.** An action a caller is allowed only because they hold `AdministerOrganisation` (they lack the specific capability, or do not own the record) is an *override* and is audited. An action they hold the specific capability for is not. This generalises today's `EventPermissions.IsAdminOverride`, `WorkspaceAccess.Admin` and `ContactAccessKind.AdminOverride`. Role changes are always audited, whoever makes them; the profile owner is notified when the actor is not acting as an administrator.
- The word **"lead"** disappears from the rules. Each place it was used names one capability instead: invites use `InviteMembers`, contacts `KeepContacts`, partners `ViewPartners` or `ManagePartners`, the RSVP list `ViewAttendees` or `ManageAttendance`, resources `AddResources`, workspace eligibility `JoinWorkspaces`, Home's quick actions `ManageEvents` ("New event") and `KeepContacts` ("Add contact"), and the pipeline card `ViewPartners`.
- **"Staff is read-only"** disappears as a rule. A caller without a write capability gets 403; a role with only view capabilities is read-only by construction. A role definition may be flagged **oversight** (`IsOversight`), which only drives the "You're viewing as {role}" banner on Home.

### Role definitions and grant rules

- A **role definition** belongs to an organisation: key, name (unique within the organisation, up to 60 characters), description (up to 200), a set of capabilities, and three flags: **shown on the team list** (`ShowOnTeam`), **may be scoped to a chapter** (`ChapterScopable`) and **oversight** (`IsOversight`). A new profile holds no role.
- A **grant rule** says "holders of role A may add and remove role B". Any role carrying `AdministerOrganisation` may grant and remove any role without a rule. A role carrying `AdministerOrganisation` can be granted only by holders of `AdministerOrganisation`, whatever the rules say. A grantor role must carry `AssignRoles` for its rules to apply.
- **Last administrator.** An organisation always keeps at least one active, unsuspended member holding a role with `AdministerOrganisation`. Removing that role, suspending that member, editing the definition so it loses `AdministerOrganisation`, or archiving it is refused when it would leave none. The `SystemAdminRoster` lease that serialises today's check becomes an `OrganisationAdminRoster` row per organisation.
- **Edits are live.** Changing a definition's capabilities changes every holder's capabilities on their next request. Losing a capability that something depends on raises `CapabilityLost(profile, capability)` in place of today's `CityLeadRoleRemoved`; the workspace handler that today reacts to a City Lead losing the role reacts to `OwnWorkspaces` being lost, and the notification becomes `WorkspaceOwnerLostCapability`.
- Definitions are **archived, never deleted**, and archival is refused while any active profile holds the role or a grant rule, share audience or announcement audience names it. Archived definitions leave pickers.
- Where the product lists roles to pick from (the role dialogs, the invite dialog, share-with-roles in resources and notes, announcement audiences, the team filter), it lists the organisation's non-archived definitions. Role audiences stay live (ADR 0025).
- Role assignments may carry a **chapter** when the definition is chapter-scopable (below).

### Chapters

- An organisation may have **chapters**: a single level, no hierarchy, with a label the organisation chooses (singular and plural, for example City/Cities, Campus/Campuses, Region/Regions). No label means the organisation has no chapters, and every chapter control and filter is hidden. FaithTech's label is **City**.
- A chapter has a name (unique within the organisation), a sort order and an archived flag. Archived chapters stay on the records that reference them and leave pickers and filters.
- **Chapters tag; they never hide.** Data stays organisation-wide. A member of one chapter sees another chapter's events, team and partners exactly as today. Private contacts remain the only visibility exception.
- A **profile** has an optional home chapter (`Profile.ChapterId`, replacing the free-text `HomeCity`). An **event** has an optional chapter (`Event.ChapterId`, replacing `Event.City`); none means organisation-wide. A **contact** keeps its free-text city: it describes an outsider and is a postal fact, not a chapter. A partner has no chapter; reports keep counting a partner under its owner's chapter (ADR 0030).
- Filters that today list distinct free-text cities (team, events, people, reports) list "All {Cities}" and the active chapters. Pickers that show "name, role and city" show "name, role · {chapter}". The connect page shows "{role} · {chapter}".
- A **role assignment** may be tagged with a chapter when its definition is chapter-scopable; the badge reads "Event Lead · Toronto". A grantor whose own grant of the grantor role is chapter-tagged may add and remove only assignments tagged with one of their own chapters; an untagged grantor may grant anywhere; administrators are never scoped. That is the whole meaning of chapter scoping: it limits who may assign, never what anyone may see.
- Migration for FaithTech: one chapter per distinct trimmed, case-folded `HomeCity` and `Event.City` value; exact matches mapped, the rest set to none and listed in the migration log.

  Rejected: a hierarchy (Region > City > Campus), which multiplies every filter and scoping rule; and chapters as a data boundary, which breaks the "data is organisation-wide" rule every existing design relies on.

### Taxonomies

Three lists that are enumerations today become per-organisation ordered lists, each entry with a key, a name, a sort order and an archived flag, archived (never deleted) once referenced:

| List | Replaces | Extra | FaithTech seed |
|---|---|---|---|
| Partner stages | `PartnerStage` | `IsInitial` (exactly one), `Kind` Open or Confirmed, so Home and Reports can still count "confirmed" | Lead (initial), In Funnel, Confirmed (kind Confirmed) |
| Event types | `EventType` | none; the "Hackathons" filter becomes "filter by type" | Gathering, Builders night, Hackathon, Prayer & planning, Panel |
| Resource types | resource type | the type guessed from a file extension maps by key, or to the organisation's "Other" | Deck, Logo, Image, Training, Template, Document, Other |

The Kanban board shows one column per active stage in order (tabs on XS), the stage history records stage keys, and a partner on an archived stage keeps it until moved.

### Organisation settings

A new section **Organisation** at `/organisation`, listed in the shell for holders of `ManageRoles` or `ManageOrganisationSettings` as a secondary section before Admin (ADR 0009). Four pages: **General** (name, short name, chapter label on or off), **Roles** (definitions, their capabilities and the grant matrix), **Chapters**, and **Stages & types**. Every change writes an audit entry under new categories `organisation`, `roles`, `chapters` and `taxonomies`, readable on the existing audit log page.

### Platform operations

- A **platform operator** is a principal outside every organisation (an operator list in configuration or a flag on the account, decided in the design), who can **provision** an organisation (slug, host, name, short name, chapter label; idempotent), **suspend and lift** it (its host answers the neutral page, its sessions are refused, other memberships of its members are untouched), and **read the platform audit log**. Operators act through the Cli (`org create`, `org suspend`, `org lift`) and a small operator API.
- An operator **cannot read organisation data**. To act inside an organisation, the operator is given a membership by that organisation's administrator. Provisioning seeds two roles, **Administrator** (`AdministerOrganisation`) and **Member** (no capability), and sends the first administrator an invite pre-assigned Administrator; that invite is the only break-glass and it is recorded in the platform audit log.

  Rejected: a template copy of FaithTech's roles under generic names for every new organisation (presumes a structure most organisations do not have); and an audited operator read of organisation data (deferred until a support need is shown).

### FaithTech seed

The seed is idempotent and reproduces today's behaviour exactly:

| Role | Capabilities | Team | Chapter-scopable | May grant |
|---|---|---|---|---|
| City Lead | ManageEvents, ViewAttendees, ManageAttendance, KeepContacts, ViewPartners, ManagePartners, InviteMembers, ConnectLink, OwnWorkspaces, JoinWorkspaces, ViewPeopleDirectory, AssignRoles, AddResources | yes | yes | Event Lead, Create Lead, Communications Lead, Volunteer, Product Engineer, Attendee |
| Event Lead | ManageEvents, ViewAttendees, ManageAttendance, KeepContacts, ViewPartners, ManagePartners, InviteMembers, JoinWorkspaces, AddResources | yes | yes | none |
| Create Lead | ViewAttendees, ManageAttendance, KeepContacts, ViewPartners, ManagePartners, InviteMembers, JoinWorkspaces, AddResources | yes | yes | none |
| Communications Lead | Create Lead's set plus SendAnnouncements | yes | yes | none |
| Staff (oversight) | ViewAttendees, ViewPartners, ReadAllWorkspaces, ViewPeopleDirectory, ViewReports, AddResources | no | no | none |
| Volunteer | JoinWorkspaces | yes | yes | none |
| Product Engineer | none | no | no | none |
| Attendee | none | no | no | none |
| System Admin | AdministerOrganisation | no | no | any (implicit) |

Checks against today's rules: Staff sees RSVP names but not guest emails (`ViewAttendees` without `ManageAttendance`), partners and every workspace read-only, People read-only, Reports, and may add resources and notes; every other Staff write is refused because Staff holds no write capability. Only City Lead and System Admin hold `ConnectLink`, `OwnWorkspaces`, `ViewPeopleDirectory` and `AssignRoles`. The chapter label is City/Cities, with chapters migrated from existing city text; the stages, event types and resource types are the three lists above. The existing seeded System Admin roster and starter resources are unchanged.

### Naming in copy

Every "FaithTech" in product copy, email and page titles becomes the organisation's name or short name ("We couldn't reach {short name}", "{name} headline", "Join {name}"). Host names in requirements become "the organisation's host". The repository, namespaces, package names and the `faithtech-community` Cli name stay.

## API

| Method and path | Purpose |
|---|---|
| `GET /api/me` | Adds `organisation`, `capabilities`, `chapter` and `memberships` |
| `GET /api/organisation` | Name, short name, chapter label, active chapters, stages, event types, resource types (every member; drives pickers and filters) |
| `PUT /api/organisation` `{ name, shortName, chapterLabelSingular?, chapterLabelPlural? }` | General settings (`ManageOrganisationSettings`) |
| `GET /api/organisation/capabilities` | The catalogue with descriptions |
| `GET/POST /api/organisation/roles`, `PUT /api/organisation/roles/{id}`, `POST /api/organisation/roles/{id}/archive` | Role definitions (`ManageRoles`) |
| `PUT /api/organisation/roles/{id}/grants` `{ grantableRoleIds }` | Grant rules (`ManageRoles`) |
| `GET/POST /api/organisation/chapters`, `PUT /api/organisation/chapters/{id}`, `PUT /api/organisation/chapters/order`, `POST /api/organisation/chapters/{id}/archive` | Chapters (`ManageOrganisationSettings`) |
| `GET/POST/PUT/order/archive` under `/api/organisation/partner-stages`, `/event-types`, `/resource-types` | Taxonomies (`ManageOrganisationSettings`) |
| `POST /api/profiles/{id}/roles` `{ roleId, chapterId? }`, `DELETE /api/profiles/{id}/roles/{roleId}` | Replace the role-name routes (`AssignRoles`, grant rules) |
| `POST /api/platform/organisations`, `POST /api/platform/organisations/{slug}/suspend`, `.../lift`, `GET /api/platform/audit` | Operator API |

Audit actions: `organisation.updated`, `role.defined`, `role.updated`, `role.archived`, `role.grants.updated`, `chapter.added`, `chapter.updated`, `chapter.archived`, `taxonomy.updated`, `member.suspended`, `member.reinstated`; platform: `organisation.provisioned`, `organisation.suspended`, `organisation.lifted`, `account.locked`.

## Screens

- `/organisation` (General), `/organisation/roles`, `/organisation/chapters`, `/organisation/taxonomies`.
- Dialogs: define-role (name, description, capabilities, flags), edit-grants, archive-role, add-chapter, rename-chapter, archive-chapter, add-list-entry, rename-list-entry, archive-list-entry.
- Account menu: **Switch organisation**.
- System pages: unknown host ("There's nothing here"), not a member ("You're not a member of {organisation}"), organisation suspended (neutral).
- Changed: role dialogs offer the organisation's roles and, for chapter-scopable ones, a chapter; profile edit's home city becomes a home {chapter} picker; the event form's city becomes a {chapter} picker; Kanban columns follow the stages; every city filter follows the chapters.

## Requirements map

| ID | Title |
|---|---|
| L1-025 | Organisations and tenancy (ORG) |
| L1-026 | Role definitions and capabilities (ROLE) |
| L1-027 | Chapters (CHAP) |
| L1-028 | Organisation settings and taxonomies (ORGSET) |
| L1-029 | Platform operations (PLAT) |
| L2-130 | Organisation record and isolation |
| L2-131 | Resolving the organisation from the host |
| L2-132 | Accounts and memberships |
| L2-133 | Organisation switcher and `/api/me` |
| L2-134 | Organisation name in copy and email |
| L2-135 | Capability catalogue and server authorisation |
| L2-136 | Role definitions |
| L2-137 | Grant rules |
| L2-138 | Assigning roles under grant rules |
| L2-139 | Last administrator and consequences of role changes |
| L2-140 | Chapter label and list |
| L2-141 | Chapters on profiles, events and role assignments |
| L2-142 | Chapter filters |
| L2-143 | Chapter-scoped granting |
| L2-144 | Partner stages |
| L2-145 | Event types |
| L2-146 | Resource types |
| L2-147 | Organisation settings page and access |
| L2-148 | Platform operator |
| L2-149 | Provisioning an organisation |
| L2-150 | Suspending and lifting an organisation |
| L2-151 | FaithTech seed |
| L2-152 | Organisation-level audit |

Existing requirements are rewritten in place, keeping their identifiers and criterion numbers: role names become capabilities, "lead", "Staff" and "System Admin" become capabilities or the administrator override, "city" becomes "{chapter}", "FaithTech" becomes "{organisation}", and fixed lists become the organisation's lists. The seeded FaithTech names appear only in `L2-151`.

ADRs: 0032 multi-tenancy (organisation per host, global accounts, profile per organisation); 0033 capability-based authorisation; 0034 chapters as tags and filters; 0035 configurable taxonomies.

## Deferred

Chapter-targeted announcement audiences; a per-organisation private-preview wall; per-organisation marketing content beyond name, short name and brochure; automated custom-host and certificate provisioning; an audited operator read of organisation data; organisation self-service sign-up (operators provision in v1); billing and plans; organisation-level branding (logo, colours); role templates for new organisations; chapter hierarchies; renaming the repository and namespaces.
