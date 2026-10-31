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

/**
 * A role assignment a profile holds, by the organisation's definition: what the profile, People and the role routes
 * answer (L2-138 AC1). `chapterId` is its chapter tag; `chapterName` names it, null when untagged and while chapters
 * are off (L2-141 AC3).
 */
export interface ProfileRole {
  id: string;
  name: string;
  chapterId: string | null;
  chapterName?: string | null;
}

/** A role badge: "{role} · {chapter}" for a tagged assignment, "{role}" otherwise (L2-141 AC3). */
export function roleBadge(role: { name: string; chapterName?: string | null }): string {
  return role.chapterName ? `${role.name} · ${role.chapterName}` : role.name;
}
