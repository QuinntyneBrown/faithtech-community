import { HttpErrorResponse } from '@angular/common/http';
import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AUTH_SERVICE,
  ChapterOption,
  ORGANISATION_SERVICE,
  OrganisationRole,
  ProfileRole,
  RolesService,
  problemDetails,
  roleBadge,
} from '@faithtech-community/api';
import {
  DialogService,
  RoleChapterPicker,
  RoleDialogComponent,
  RoleDialogData,
} from '@faithtech-community/components';
import { firstValueFrom } from 'rxjs';

/** The member whose roles change. */
export interface RoleTarget {
  id: string;
  name: string;
  roles: ProfileRole[];
}

export type RoleMode = 'add' | 'remove';

/**
 * What the caller may offer (L2-137 AC5): the organisation's roles, the ids the server says the caller may
 * add and remove, whether they act as an administrator, and the names of the roles they hold. With chapters on:
 * the singular chapter label, the active chapters, and the chapters a scoped grantor works within, with the
 * names of their tagged roles (L2-143).
 */
export interface RoleChoices {
  roles: readonly OrganisationRole[];
  grantableRoleIds: readonly string[];
  administrator: boolean;
  heldRoleNames: readonly string[];
  /** The singular chapter label; null while chapters are off. */
  chapterLabel?: string | null;
  chapters?: readonly ChapterOption[];
  /** The chapters a scoped grantor may grant in; null when the caller is never scoped. */
  grantChapterIds?: readonly string[] | null;
  /** The caller's tagged roles' names, for "Your {role} role is for {chapter}". */
  scopedRoleNames?: readonly string[];
}

/**
 * The caller's choices from GET /api/organisation and /api/me. Call it in an injection context. Until the
 * organisation arrives there are no roles, so no role action shows.
 */
export function injectRoleChoices(): Signal<RoleChoices> {
  const auth = inject(AUTH_SERVICE);
  const organisation = toSignal(inject(ORGANISATION_SERVICE).get(), { initialValue: null });
  return computed(() => {
    const user = auth.currentUser();
    const grantChapterIds = user?.grantChapterIds ?? null;
    const held = user?.roles ?? [];
    return {
      roles: organisation()?.roles ?? [],
      grantableRoleIds: auth.grantableRoleIds(),
      administrator: auth.capabilities().includes('AdministerOrganisation'),
      heldRoleNames: [...new Set(held.map((r) => r.name))],
      chapterLabel: organisation()?.chapterLabel?.singular ?? null,
      chapters: organisation()?.chapters ?? [],
      grantChapterIds,
      scopedRoleNames: [
        ...new Set(
          held
            .filter((r) => r.chapterId && grantChapterIds?.includes(r.chapterId))
            .map((r) => r.name),
        ),
      ],
    };
  });
}

/** Whether `roleId` is held for a chapter here: chapter-scopable while chapters are on (L2-141 AC3). */
function scopable(choices: RoleChoices, roleId: string): boolean {
  return !!choices.chapterLabel && !!choices.roles.find((r) => r.id === roleId)?.chapterScopable;
}

/**
 * Roles the caller may add: grantable, and not yet held unless they can be held again for another chapter
 * (L2-138 AC7).
 */
export function addableRoles(choices: RoleChoices, target: RoleTarget): OrganisationRole[] {
  return choices.roles.filter(
    (r) =>
      choices.grantableRoleIds.includes(r.id) &&
      (scopable(choices, r.id) || !target.roles.some((h) => h.id === r.id)),
  );
}

/**
 * Held assignments the caller may remove: grantable, and for a scoped grantor only those tagged with one of their
 * chapters (L2-143 AC2).
 */
export function removableRoles(choices: RoleChoices, target: RoleTarget): ProfileRole[] {
  const within = choices.grantChapterIds;
  return target.roles.filter(
    (h) =>
      choices.grantableRoleIds.includes(h.id) &&
      (!within || !scopable(choices, h.id) || (!!h.chapterId && within.includes(h.chapterId))),
  );
}

/** "Toronto", "Toronto and Austin", "Toronto, Austin and Halifax". */
function listOf(names: readonly string[]): string {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : (names[0] ?? '');
}

/**
 * The chapter picker for the add-role dialog (docs/mocks/dialogs/add-role chapter, admin): required and narrowed to a
 * scoped grantor's chapters; otherwise optional over every active chapter. Absent while chapters are off.
 */
function chapterPicker(choices: RoleChoices, target: RoleTarget): RoleChapterPicker | undefined {
  const label = choices.chapterLabel;
  if (!label) return undefined;
  const within = choices.grantChapterIds;
  const chapters = (choices.chapters ?? []).filter((c) => !within || within.includes(c.id));
  const names = listOf(chapters.map((c) => c.name));
  const lower = label.toLowerCase();
  return {
    label,
    roleIds: choices.roles.filter((r) => r.chapterScopable).map((r) => r.id),
    options: chapters.map((c) => ({ value: c.id, label: c.name })),
    required: !!within,
    help: within
      ? (role) =>
          `Your ${listOf(choices.scopedRoleNames ?? [])} role is for ${names}, so you can grant ${role} for ${names} only.`
      : (role) =>
          `${role} can be held for a ${lower}. The tag never limits what ${target.name.split(' ')[0]} sees.`,
  };
}

/** An assignment as a remove-dialog option value: its role id and chapter tag. */
const assignmentValue = (r: ProfileRole) => `${r.id}|${r.chapterId ?? ''}`;

/** Who may grant what, under the add-role options (docs/mocks/dialogs/add-role). */
function addCaption(choices: RoleChoices, target: RoleTarget): string {
  if (choices.administrator) {
    const first = target.name.split(' ')[0];
    return `As an administrator you can grant any role. The change is recorded in the audit log, and ${first} isn’t notified.`;
  }
  const names = choices.heldRoleNames;
  const held =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} roles`
      : `${names[0] ?? ''} role`;
  return `These are the roles your ${held} may grant. An administrator can grant any role.`;
}

/**
 * Opens the shared role dialog (ADR 0005) for the profile and people pages. `changed` receives the held
 * roles the server answers with, so the screen updates without a reload (L2-138 AC1).
 */
export function openRoleDialog(
  dialogs: DialogService,
  rolesService: RolesService,
  choices: RoleChoices,
  target: RoleTarget,
  mode: RoleMode,
  changed: (roles: ProfileRole[]) => void,
): void {
  const description = (id: string) => choices.roles.find((r) => r.id === id)?.description;
  const options =
    mode === 'add'
      ? addableRoles(choices, target).map((r) => ({
          value: r.id,
          label: r.name,
          description: r.description || undefined,
        }))
      : removableRoles(choices, target).map((r) => ({
          value: assignmentValue(r),
          label: roleBadge(r),
          description: description(r.id) || undefined,
        }));
  const held = [...new Set(target.roles.map((r) => r.name))];
  const data: RoleDialogData = {
    mode,
    name: target.name,
    description:
      mode === 'add'
        ? `${target.name} ${held.length ? `holds ${held.join(', ')}` : 'has no role yet'}. People can hold several roles at once.`
        : `${target.name} stays a member and keeps any other roles. The change is recorded in the audit log.`,
    options,
    caption: mode === 'add' ? addCaption(choices, target) : undefined,
    chapter: mode === 'add' ? chapterPicker(choices, target) : undefined,
    submit: (value, chapterId) => {
      // A removal names the assignment: its role and its tag.
      const [roleId, tag] = mode === 'add' ? [value, chapterId] : value.split('|');
      return changeRole(rolesService, target.id, mode, roleId, tag || null, changed);
    },
  };
  dialogs.open(RoleDialogComponent, { data });
}

/** Resolves to null once `changed` has the new roles, or to the server's refusal. */
async function changeRole(
  rolesService: RolesService,
  id: string,
  mode: RoleMode,
  roleId: string,
  chapterId: string | null,
  changed: (roles: ProfileRole[]) => void,
): Promise<string | null> {
  try {
    const call =
      mode === 'add'
        ? rolesService.addRole(id, roleId, chapterId)
        : rolesService.removeRole(id, roleId, chapterId);
    changed(await firstValueFrom(call));
    return null;
  } catch (error) {
    if (
      error instanceof HttpErrorResponse &&
      (error.status === 400 || error.status === 403 || error.status === 409)
    ) {
      return (
        problemDetails(error)?.detail ??
        problemDetails(error)?.errors?.['Role']?.[0] ??
        problemDetails(error)?.errors?.['ChapterId']?.[0] ??
        'You can’t make that change.'
      );
    }
    throw error;
  }
}
