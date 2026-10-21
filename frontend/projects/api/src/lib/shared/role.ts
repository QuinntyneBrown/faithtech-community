/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 */
// TODO(slice): confirm the backend serialises enums as strings.
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
