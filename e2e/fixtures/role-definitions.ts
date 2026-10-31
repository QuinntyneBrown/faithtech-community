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

export interface RoleDefinition {
  /** The seed's fixed id, as the API's FaithTechSeed gives it. */
  id: string;
  key: string;
  name: string;
  capabilities: Capability[];
  showOnTeam: boolean;
  chapterScopable: boolean;
  isOversight: boolean;
  grants: string[];
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

/** The union of the capabilities of the held roles, in catalogue order (L2-135 AC2). */
export function capabilitiesOf(
  roles: readonly string[],
  definitions = FAITHTECH_ROLES,
): Capability[] {
  const held = new Set(
    definitions.filter((d) => roles.includes(d.key)).flatMap((d) => d.capabilities),
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
  return FAITHTECH_ROLES.filter((d) => roles.includes(d.key)).map((d) => ({
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
  return FAITHTECH_ROLES.some((d) => roles.includes(d.key) && d.capabilities.includes(capability));
}

/** Whether a profile holds a role shown on the team (L2-046, ShowOnTeam). */
export function onTeam(roles: readonly string[]): boolean {
  return FAITHTECH_ROLES.some((d) => roles.includes(d.key) && d.showOnTeam);
}

/** The definition of a FaithTech role key, or undefined for a key the seed does not define. */
export function definitionOf(key: string): RoleDefinition | undefined {
  return FAITHTECH_ROLES.find((d) => d.key === key);
}

/**
 * Whether a caller may grant or remove a role, as RoleAssignmentPolicy answers: AdministerOrganisation grants
 * anything; otherwise AssignRoles plus a grant rule of a held role, and never a role carrying
 * AdministerOrganisation (ADR 0033, L2-134).
 */
export function canGrant(
  caller: { roles: readonly string[]; capabilities?: readonly Capability[] },
  role: string,
): boolean {
  const held = caller.capabilities ?? capabilitiesOf(caller.roles);
  if (held.includes('AdministerOrganisation')) return true;
  if (!held.includes('AssignRoles')) return false;
  if (definitionOf(role)?.capabilities.includes('AdministerOrganisation')) return false;
  return FAITHTECH_ROLES.some((d) => caller.roles.includes(d.key) && d.grants.includes(role));
}

/** The name of a profile's first role, in display order, carrying any of the capabilities (the API's LinkRole, hostRole). */
export function firstRoleCarrying(
  roles: readonly string[],
  ...capabilities: Capability[]
): string | null {
  return (
    FAITHTECH_ROLES.find(
      (d) => roles.includes(d.key) && capabilities.some((c) => d.capabilities.includes(c)),
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
