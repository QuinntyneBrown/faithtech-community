/**
 * The platform's capability catalogue (L2-135 AC1, ADR 0033). The app decides what to show from the caller's
 * capabilities, never a role name; hiding is a convenience and the server stays the authority (L2-135 AC7).
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

/** Whether `held` includes any of `wanted`; AdministerOrganisation holds every capability (L2-135 AC3). */
export function hasAny(held: readonly Capability[], ...wanted: Capability[]): boolean {
  return held.includes('AdministerOrganisation') || wanted.some((c) => held.includes(c));
}

/** A role the caller holds, as the organisation names it (L2-133 AC1). */
export interface HeldRole {
  id: string;
  /** Names the role in requests until role pickers use ids (slice 14). */
  key: string;
  name: string;
  chapterId: string | null;
  /** An oversight role reads across the organisation without changing it, like FaithTech's Staff. */
  isOversight: boolean;
}
