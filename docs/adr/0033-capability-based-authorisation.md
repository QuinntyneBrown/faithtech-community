# 0033. Capability-based authorisation replaces the role enumeration

- Status: Accepted
- Date: 2026-10-30
- Requirements: L1-026, L2-135 to L2-139, L2-151, and every requirement that names a role
- Designs: `docs/detailed-designs/organisations/capabilities-and-authorization`, `docs/detailed-designs/organisations/role-definitions-and-grant-rules`, `docs/detailed-designs/organisations/seed-faithtech`, `docs/detailed-designs/platform/server-authorization`, `docs/detailed-designs/admin/assign-roles`
- Proposal: `docs/proposals/organisations.md`
- Refines: ADR 0004, ADR 0005, ADR 0009, ADR 0011, ADR 0014, ADR 0017, ADR 0025, ADR 0029, ADR 0031

## Context

Permissions are decided by role name. `Role` is a Domain enumeration of nine values; `RoleAssignmentPolicy`, `LeadRoles`, `TeamRoles`, `EventPermissions`, `WorkspaceAccess`, `ContactAccess` and `ReportAccess` compare against them; `role.ts` and `navigation.ts` copy the rules into the frontend and `mock-api.ts` copies them into the e2e fake. An organisation that wants a "Meet-up Lead", a "Campus Pastor" or no "Staff" at all cannot have one. The proposal makes roles an organisation's data.

## Decision

- **A fixed capability catalogue** lives in the Domain (`Domain/Organisations/Capability.cs`, string keys): `ManageEvents`, `ViewAttendees`, `ManageAttendance`, `KeepContacts`, `ViewPartners`, `ManagePartners`, `InviteMembers`, `ConnectLink`, `OwnWorkspaces`, `JoinWorkspaces`, `ReadAllWorkspaces`, `ViewPeopleDirectory`, `AssignRoles`, `SendAnnouncements`, `AddResources`, `ViewReports`, `ManageRoles`, `ManageOrganisationSettings`, `AdministerOrganisation`. Adding a capability is a code change with a requirement; an organisation cannot add one. Baseline member rights are not capabilities.
- **A role definition** (`RoleDefinition`, per organisation) is a name, a description, a set of capabilities and three flags: `ShowOnTeam`, `ChapterScopable`, `IsOversight`. `ProfileRole` references a definition (and optionally a chapter) instead of an enumeration value. **Grant rules** (`RoleGrantRule`: grantor definition, grantable definition) replace `CityLeadRoles`; `AdministerOrganisation` grants anything implicitly and can be granted only by `AdministerOrganisation`.
- **Handlers check capabilities.** `ICurrentUser` exposes `Capabilities` and `Has(capability)`; `CurrentRolesMiddleware` computes the set from the caller's current roles in the current organisation on every request, so definition edits and role changes are live without token revocation (the role freshness policy of `L2-042` AC4 unchanged). `HasRole(Role)` is removed. `LeadRoles` and `TeamRoles` are deleted; each use names one capability (the proposal's table). `RoleAssignmentPolicy` becomes `RoleGrantPolicy` over the grant rules and chapter scoping. The access classes (`EventPermissions`, `WorkspaceAccessPolicy`, `ContactAccess`, `PartnerAccess`, `ReportAccess`, `ResourceAccess`, `NoteAccess`) keep their shape and read capabilities.
- **Override rule.** `AuthorizationRules.IsOverride(actor, capability)` is true when the actor is allowed only because they hold `AdministerOrganisation`. Every override is audited (`L2-041`); an action the actor holds the specific capability for is not. This is the one rule behind today's `IsAdminOverride`, `WorkspaceAccess.Admin` and `ContactAccessKind.AdminOverride`.
- **Last administrator.** `OrganisationAdminRoster` (one row per organisation) replaces `SystemAdminRoster` and keeps its 30-second lease; the guarded operations grow from "remove the role" to "remove the role, suspend the holder, edit the definition's capabilities, archive the definition".
- **Domain events by capability.** `CityLeadRoleRemoved` becomes `CapabilityLost(profileId, capability)`, raised when a role removal or a definition edit takes a capability away from a profile that no other role still gives. The workspace handler reacts to `OwnWorkspaces`; the notification kind is `WorkspaceOwnerLostCapability`.
- **The frontend reads capabilities**, never role names: `/api/me` returns `capabilities`, `navigation.ts` keys each section on a capability (ADR 0009 refined: Contacts `KeepContacts`; Partners `ViewPartners`; Workspaces `OwnWorkspaces`, `JoinWorkspaces` or `ReadAllWorkspaces`; People `ViewPeopleDirectory`; Reports `ViewReports`; Organisation `ManageRoles` or `ManageOrganisationSettings`; Admin `AdministerOrganisation`), and `role.ts` loses `ROLES`, `CITY_LEAD_ROLES`, `LEAD_ROLES`, `assignableRoles` and `isLead`. Role names and descriptions come from `GET /api/organisation` for display only. The role dialogs in `components` (ADR 0005) take the option list as data, as they already do.
- **The e2e fake** holds the FaithTech seed (definitions and grant rules) as data and computes capabilities the same way, so specs keep signing in "as a City Lead" while the app only ever sees capabilities.

Rejected: keeping the enumeration and letting organisations rename roles (cannot express a new role or a different split of rights); per-record ACLs (nothing in the product needs them); capability bits stored on the token (stale after an edit, the very problem the role freshness policy solved).

## Consequences

- About 26 Application files change a comparison, not their structure; the tests for who must **not** see a record become tests over capability sets, with the FaithTech seed as the regression case.
- "Staff is read-only" is no longer a rule anywhere; it is a consequence of the Staff definition holding only view capabilities. The AGENTS.md domain rules are rewritten in those terms.
- Requirements and designs name capabilities, with "(seeded as City Lead in FaithTech)" where a reader needs the old word once.
