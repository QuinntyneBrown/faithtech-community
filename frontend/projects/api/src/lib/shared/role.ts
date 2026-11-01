/**
 * A role definition's key, as the API serialises a role a member holds, an invite pre-assigns or a resource is shared
 * with. The organisation defines its roles (ADR 0033); `OrganisationRoles` names them.
 */
export type Role = string;

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
