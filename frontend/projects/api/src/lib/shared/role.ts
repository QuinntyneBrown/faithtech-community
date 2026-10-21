/** The nine global roles (L2-008), serialised by the API as these strings. */
export const ROLES = [
  'CityLead',
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'Staff',
  'Volunteer',
  'ProductEngineer',
  'Attendee',
  'SystemAdmin',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  CityLead: 'City Lead',
  EventLead: 'Event Lead',
  CreateLead: 'Create Lead',
  CommunicationsLead: 'Communications Lead',
  Staff: 'Staff',
  Volunteer: 'Volunteer',
  ProductEngineer: 'Product Engineer',
  Attendee: 'Attendee',
  SystemAdmin: 'System Admin',
};

/** One line on what each role does, shown beside the role in the role dialog. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  CityLead: 'Leads a city team and manages its roles',
  EventLead: 'Creates and manages events',
  CreateLead: 'Runs hackathon builders and projects',
  CommunicationsLead: 'Sends announcements',
  Staff: 'Read-only oversight across FaithTech',
  Volunteer: 'Joins the city team',
  ProductEngineer: 'Builds at hackathons',
  Attendee: 'Comes to events',
  SystemAdmin: 'Full administration and the audit log',
};

const CITY_LEAD_ROLES: readonly Role[] = [
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'Volunteer',
  'ProductEngineer',
  'Attendee',
];

const LEAD_ROLES: readonly Role[] = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];

/**
 * The roles a caller holding `callerRoles` may grant or remove (L2-009), mirroring the server's
 * RoleAssignmentPolicy (ADR 0005). The server stays the authority and answers 403 for the rest.
 */
export function assignableRoles(callerRoles: readonly Role[]): Role[] {
  if (callerRoles.includes('SystemAdmin')) return [...ROLES];
  if (callerRoles.includes('CityLead')) return [...CITY_LEAD_ROLES];
  return [];
}

/** Leads and System Admins may send invites (L2-010). */
export function isLead(callerRoles: readonly Role[]): boolean {
  return callerRoles.some((r) => r === 'SystemAdmin' || LEAD_ROLES.includes(r));
}
