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

/** FaithTech's nine roles in display order; each key is the role value the app still reads until slice 12. */
export const FAITHTECH_ROLES: RoleDefinition[] = [
  {
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
    key: 'CreateLead',
    name: 'Create Lead',
    capabilities: CREATE_LEAD,
    showOnTeam: true,
    chapterScopable: true,
    isOversight: false,
    grants: [],
  },
  {
    key: 'CommunicationsLead',
    name: 'Communications Lead',
    capabilities: [...CREATE_LEAD, 'SendAnnouncements'],
    showOnTeam: true,
    chapterScopable: true,
    isOversight: false,
    grants: [],
  },
  {
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
    key: 'Volunteer',
    name: 'Volunteer',
    capabilities: ['JoinWorkspaces'],
    showOnTeam: true,
    chapterScopable: true,
    isOversight: false,
    grants: [],
  },
  {
    key: 'ProductEngineer',
    name: 'Product Engineer',
    capabilities: [],
    showOnTeam: false,
    chapterScopable: false,
    isOversight: false,
    grants: [],
  },
  {
    key: 'Attendee',
    name: 'Attendee',
    capabilities: [],
    showOnTeam: false,
    chapterScopable: false,
    isOversight: false,
    grants: [],
  },
  {
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
