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
