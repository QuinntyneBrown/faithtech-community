/**
 * The platform's capability catalogue and FaithTech's role definitions as data, mirroring the API's seed
 * (L2-135 AC1, L2-151 AC2). The fake computes a member's capabilities from these, as the API does.
 */
export const CAPABILITIES = [
  'ManageEvents',
  'ViewAttendees',
  'ManageAttendance',
  'KeepContacts',
  'ViewPartners',
  'ManagePartners',
  'InviteMembers',
  'ConnectLink',
  'OwnWorkspaces',
  'JoinWorkspaces',
  'ReadAllWorkspaces',
  'ViewPeopleDirectory',
  'AssignRoles',
  'SendAnnouncements',
  'AddResources',
  'ViewReports',
  'ManageRoles',
  'ManageOrganisationSettings',
  'AdministerOrganisation',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Each capability's one-line description, as the API's catalogue gives it. */
export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  ManageEvents: 'Create, edit and cancel events.',
  ViewAttendees: "See who has RSVP'd to events and who checked in.",
  ManageAttendance: 'Check people in, add walk-ins, see guest emails and export RSVPs.',
  KeepContacts: 'Keep private contacts and notes about people met.',
  ViewPartners: 'See the partner pipeline.',
  ManagePartners: 'Add, edit, move and merge partners.',
  InviteMembers: 'Invite people to join the organisation.',
  ConnectLink: 'Have a reusable QR code that adds people met as contacts.',
  OwnWorkspaces: 'Create and own agile workspaces.',
  JoinWorkspaces: 'Be added as a member of agile workspaces.',
  ReadAllWorkspaces: 'Read every agile workspace without being a member.',
  ViewPeopleDirectory: 'See the full people directory, with emails.',
  AssignRoles: 'Grant and remove the roles the grant rules allow.',
  SendAnnouncements: 'Compose and send announcements.',
  AddResources: 'Add resources and share them.',
  ViewReports: 'See the Reports page and export its figures.',
  ManageRoles: 'Define, edit and archive roles and their grant rules.',
  ManageOrganisationSettings: "Edit the organisation's name, chapters, stages and types.",
  AdministerOrganisation: 'Do anything in the organisation; every override is audited.',
};

export interface RoleDefinition {
  /** The seed's fixed id, as the API's FaithTechSeed gives it. */
  id: string;
  key: string;
  name: string;
  description?: string;
  capabilities: Capability[];
  showOnTeam: boolean;
  chapterScopable: boolean;
  isOversight: boolean;
  grants: string[];
  archived?: boolean;
}

const CREATE_LEAD: Capability[] = [
  'ViewAttendees',
  'ManageAttendance',
  'KeepContacts',
  'ViewPartners',
  'ManagePartners',
  'InviteMembers',
  'JoinWorkspaces',
  'AddResources',
];

/** FaithTech's nine roles in display order, with the seed's ids and keys (L2-151 AC2). */
export const FAITHTECH_ROLES: RoleDefinition[] = [
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7001',
    key: 'CityLead',
    name: 'City Lead',
    capabilities: [
      'ManageEvents',
      'ViewAttendees',
      'ManageAttendance',
      'KeepContacts',
      'ViewPartners',
      'ManagePartners',
      'InviteMembers',
      'ConnectLink',
      'OwnWorkspaces',
      'JoinWorkspaces',
      'ViewPeopleDirectory',
      'AssignRoles',
      'AddResources',
    ],
    showOnTeam: true,
    chapterScopable: true,
    isOversight: false,
    grants: [
      'EventLead',
      'CreateLead',
      'CommunicationsLead',
      'Volunteer',
      'ProductEngineer',
      'Attendee',
    ],
  },
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7002',
    key: 'EventLead',
    name: 'Event Lead',
    capabilities: [
      'ManageEvents',
      'ViewAttendees',
      'ManageAttendance',
      'KeepContacts',
      'ViewPartners',
      'ManagePartners',
      'InviteMembers',
      'JoinWorkspaces',
      'AddResources',
    ],
    showOnTeam: true,
    chapterScopable: true,
    isOversight: false,
    grants: [],
  },
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7003',
    key: 'CreateLead',
    name: 'Create Lead',
    capabilities: CREATE_LEAD,
    showOnTeam: true,
    chapterScopable: true,
    isOversight: false,
    grants: [],
  },
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7004',
    key: 'CommunicationsLead',
    name: 'Communications Lead',
    capabilities: [...CREATE_LEAD, 'SendAnnouncements'],
    showOnTeam: true,
    chapterScopable: true,
    isOversight: false,
    grants: [],
  },
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7005',
    key: 'Staff',
    name: 'Staff',
    capabilities: [
      'ViewAttendees',
      'ViewPartners',
      'ReadAllWorkspaces',
      'ViewPeopleDirectory',
      'ViewReports',
      'AddResources',
    ],
    showOnTeam: false,
    chapterScopable: false,
    isOversight: true,
    grants: [],
  },
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7006',
    key: 'Volunteer',
    name: 'Volunteer',
    capabilities: ['JoinWorkspaces'],
    showOnTeam: true,
    chapterScopable: true,
    isOversight: false,
    grants: [],
  },
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7007',
    key: 'ProductEngineer',
    name: 'Product Engineer',
    capabilities: [],
    showOnTeam: false,
    chapterScopable: false,
    isOversight: false,
    grants: [],
  },
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7008',
    key: 'Attendee',
    name: 'Attendee',
    capabilities: [],
    showOnTeam: false,
    chapterScopable: false,
    isOversight: false,
    grants: [],
  },
  {
    id: '0f7a1c2e-5b4d-4e8a-9c61-2d3f4a5b7009',
    key: 'SystemAdmin',
    name: 'System Admin',
    capabilities: ['AdministerOrganisation'],
    showOnTeam: false,
    chapterScopable: false,
    isOversight: false,
    grants: [],
  },
];

/**
 * The host organisation's definitions for the running test: FaithTech's seed, plus any a spec defines with
 * `api.defineRole`. The fixture resets them for every test, so one test's roles never reach another.
 */
let definitions: RoleDefinition[] = [];
resetRoleDefinitions();

export function resetRoleDefinitions(): void {
  definitions = FAITHTECH_ROLES.map((d) => ({ ...d, grants: [...d.grants] }));
}

/** Every definition, archived ones included, in display order. */
export function roleDefinitions(): readonly RoleDefinition[] {
  return definitions;
}

/** Adds a test-defined role (ADR 0033): any name, capabilities and grant rules, by key. */
export function defineRole(
  role: Pick<RoleDefinition, 'key' | 'name'> & Partial<RoleDefinition>,
): RoleDefinition {
  const definition: RoleDefinition = {
    id: `role-${role.key}`,
    description: '',
    capabilities: [],
    showOnTeam: false,
    chapterScopable: false,
    isOversight: false,
    grants: [],
    ...role,
  };
  definitions.push(definition);
  return definition;
}

/** The union of the capabilities of the held roles, in catalogue order (L2-135 AC2). */
export function capabilitiesOf(roles: readonly string[]): Capability[] {
  const held = new Set(
    definitions.filter((d) => !d.archived && roles.includes(d.key)).flatMap((d) => d.capabilities),
  );
  return CAPABILITIES.filter((c) => held.has(c));
}

/** A role a member holds, as /api/me answers it (L2-133 AC1). */
export interface HeldRole {
  id: string;
  key: string;
  name: string;
  chapterId: string | null;
  isOversight: boolean;
}

/** The held roles, in display order, as /api/me answers them. */
export function heldRolesOf(roles: readonly string[]): HeldRole[] {
  return definitions
    .filter((d) => roles.includes(d.key))
    .map((d) => ({
      id: d.id,
      key: d.key,
      name: d.name,
      chapterId: null,
      isOversight: d.isOversight,
    }));
}

/**
 * Whether a caller holds a capability, as ICurrentUser.Has answers: an explicit capability set, else the
 * capabilities of the FaithTech roles held; AdministerOrganisation holds every capability (L2-135 AC2).
 */
export function holds(
  caller: { roles: readonly string[]; capabilities?: readonly Capability[] },
  capability: Capability,
): boolean {
  const held = caller.capabilities ?? capabilitiesOf(caller.roles);
  return held.includes(capability) || held.includes('AdministerOrganisation');
}

/**
 * Whether a profile's own FaithTech roles carry a capability, with no AdministerOrganisation stand-in, as the
 * API's ProfileHolding filter answers for owners, members and the team.
 */
export function carries(roles: readonly string[], capability: Capability): boolean {
  return definitions.some(
    (d) => !d.archived && roles.includes(d.key) && d.capabilities.includes(capability),
  );
}

/** Whether a profile holds a role shown on the team (L2-046, ShowOnTeam). */
export function onTeam(roles: readonly string[]): boolean {
  return definitions.some((d) => !d.archived && roles.includes(d.key) && d.showOnTeam);
}

/** The definition of a role key, or undefined for a key the organisation does not define. */
export function definitionOf(key: string): RoleDefinition | undefined {
  return definitions.find((d) => d.key === key);
}

/** The definition with an id, or undefined for an id the organisation does not define. */
export function definitionWithId(id: string): RoleDefinition | undefined {
  return definitions.find((d) => d.id === id);
}

/** The keys of the roles held, as a profile answers them (L2-138 AC1). */
export function profileRolesOf(roles: readonly string[]) {
  return definitions
    .filter((d) => roles.includes(d.key))
    .map((d) => ({ id: d.id, name: d.name, chapterId: null }));
}

/**
 * The keys of the roles a caller may add and remove, as RoleGrantPolicy answers: every role not archived for
 * AdministerOrganisation; otherwise the grant rules of the held roles that carry AssignRoles, never a role
 * carrying AdministerOrganisation (ADR 0033, L2-137 AC2-AC4).
 */
export function grantableKeys(caller: {
  roles: readonly string[];
  capabilities?: readonly Capability[];
}): string[] {
  const live = definitions.filter((d) => !d.archived);
  const held = caller.capabilities ?? capabilitiesOf(caller.roles);
  if (held.includes('AdministerOrganisation')) return live.map((d) => d.key);
  if (!held.includes('AssignRoles')) return [];
  const byRule = new Set(
    live
      .filter((d) => caller.roles.includes(d.key) && d.capabilities.includes('AssignRoles'))
      .flatMap((d) => d.grants),
  );
  return live
    .filter((d) => byRule.has(d.key) && !d.capabilities.includes('AdministerOrganisation'))
    .map((d) => d.key);
}

/** Whether a caller may grant or remove a role (RoleGrantPolicy.CanGrantAsync). */
export function canGrant(
  caller: { roles: readonly string[]; capabilities?: readonly Capability[] },
  role: string,
): boolean {
  return grantableKeys(caller).includes(role);
}

/**
 * Whether a change is the administrator's, allowed only through AdministerOrganisation and not by a rule the
 * caller holds: it does not notify the owner (L2-138 AC3).
 */
export function actsAsAdministrator(
  caller: { roles: readonly string[]; capabilities?: readonly Capability[] },
  role: string,
): boolean {
  const held = caller.capabilities ?? capabilitiesOf(caller.roles);
  if (!held.includes('AdministerOrganisation')) return false;
  return !definitions.some(
    (d) =>
      !d.archived &&
      caller.roles.includes(d.key) &&
      d.capabilities.includes('AssignRoles') &&
      d.grants.includes(role) &&
      !definitionOf(role)?.capabilities.includes('AdministerOrganisation'),
  );
}

/** The name of a profile's first role, in display order, carrying any of the capabilities (the API's LinkRole, hostRole). */
export function firstRoleCarrying(
  roles: readonly string[],
  ...capabilities: Capability[]
): string | null {
  return (
    definitions.find(
      (d) =>
        !d.archived &&
        roles.includes(d.key) &&
        capabilities.some((c) => d.capabilities.includes(c)),
    )?.name ?? null
  );
}

/** An action allowed only through AdministerOrganisation, which the API audits (AuthorizationRules.IsOverride). */
export function isOverride(
  caller: { roles: readonly string[]; capabilities?: readonly Capability[] },
  capability: Capability,
): boolean {
  const held = caller.capabilities ?? capabilitiesOf(caller.roles);
  return held.includes('AdministerOrganisation') && !held.includes(capability);
}

/** A role a resource or page can be shared with: any defined role but one carrying AdministerOrganisation. */
export function isShareable(key: string): boolean {
  const definition = definitionOf(key);
  return !!definition && !definition.capabilities.includes('AdministerOrganisation');
}
