import { HttpErrorResponse } from '@angular/common/http';
import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AUTH_SERVICE,
  ORGANISATION_SERVICE,
  OrganisationRole,
  ProfileRole,
  RolesService,
  problemDetails,
} from '@faithtech-community/api';
import {
  DialogService,
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
 * add and remove, whether they act as an administrator, and the names of the roles they hold.
 */
export interface RoleChoices {
  roles: readonly OrganisationRole[];
  grantableRoleIds: readonly string[];
  administrator: boolean;
  heldRoleNames: readonly string[];
}

/**
 * The caller's choices from GET /api/organisation and /api/me. Call it in an injection context. Until the
 * organisation arrives there are no roles, so no role action shows.
 */
export function injectRoleChoices(): Signal<RoleChoices> {
  const auth = inject(AUTH_SERVICE);
  const organisation = toSignal(inject(ORGANISATION_SERVICE).get(), { initialValue: null });
  return computed(() => ({
    roles: organisation()?.roles ?? [],
    grantableRoleIds: auth.grantableRoleIds(),
    administrator: auth.capabilities().includes('AdministerOrganisation'),
    heldRoleNames: (auth.currentUser()?.roles ?? []).map((r) => r.name),
  }));
}

/** Roles the caller may add: grantable and not yet held. */
export function addableRoles(choices: RoleChoices, target: RoleTarget): OrganisationRole[] {
  return choices.roles.filter(
    (r) => choices.grantableRoleIds.includes(r.id) && !target.roles.some((h) => h.id === r.id),
  );
}

/** Held roles the caller may remove. */
export function removableRoles(choices: RoleChoices, target: RoleTarget): ProfileRole[] {
  return target.roles.filter((h) => choices.grantableRoleIds.includes(h.id));
}

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
          value: r.id,
          label: r.name,
          description: description(r.id) || undefined,
        }));
  const held = target.roles.map((r) => r.name);
  const data: RoleDialogData = {
    mode,
    name: target.name,
    description:
      mode === 'add'
        ? `${target.name} ${held.length ? `holds ${held.join(', ')}` : 'has no role yet'}. People can hold several roles at once.`
        : `${target.name} stays a member and keeps any other roles. The change is recorded in the audit log.`,
    options,
    caption: mode === 'add' ? addCaption(choices, target) : undefined,
    submit: (roleId) => changeRole(rolesService, target.id, mode, roleId, changed),
  };
  dialogs.open(RoleDialogComponent, { data });
}

/** Resolves to null once `changed` has the new roles, or to the server's refusal. */
async function changeRole(
  rolesService: RolesService,
  id: string,
  mode: RoleMode,
  roleId: string,
  changed: (roles: ProfileRole[]) => void,
): Promise<string | null> {
  try {
    const call =
      mode === 'add' ? rolesService.addRole(id, roleId) : rolesService.removeRole(id, roleId);
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
        'You can’t make that change.'
      );
    }
    throw error;
  }
}
