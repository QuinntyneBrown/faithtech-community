import { HttpErrorResponse } from '@angular/common/http';
import {
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  Role,
  RolesService,
  assignableRoles,
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
  roles: Role[];
}

export type RoleMode = 'add' | 'remove';

/** Roles the caller may add: assignable and not yet held (L2-009). */
export function addableRoles(callerRoles: readonly Role[], target: RoleTarget): Role[] {
  return assignableRoles(callerRoles).filter((r) => !target.roles.includes(r));
}

/** Held roles the caller may remove (L2-009). */
export function removableRoles(callerRoles: readonly Role[], target: RoleTarget): Role[] {
  const assignable = assignableRoles(callerRoles);
  return ROLES.filter((r) => target.roles.includes(r) && assignable.includes(r));
}

/**
 * Opens the shared role dialog (ADR 0005) for the profile and people pages. `changed` receives the
 * role set the server answers with, so the screen updates without a reload (L2-009 AC5).
 */
export function openRoleDialog(
  dialogs: DialogService,
  rolesService: RolesService,
  callerRoles: readonly Role[],
  target: RoleTarget,
  mode: RoleMode,
  changed: (roles: Role[]) => void,
): void {
  const roles =
    mode === 'add' ? addableRoles(callerRoles, target) : removableRoles(callerRoles, target);
  const held = target.roles.map((r) => ROLE_LABELS[r]);
  const data: RoleDialogData = {
    mode,
    name: target.name,
    description:
      mode === 'add'
        ? `${target.name} ${held.length ? `holds ${held.join(', ')}` : 'has no role yet'}. People can hold several roles at once.`
        : `${target.name} stays a member and keeps any other roles. The change is recorded in the audit log.`,
    options: roles.map((r) => ({
      value: r,
      label: ROLE_LABELS[r],
      description: ROLE_DESCRIPTIONS[r],
    })),
    caption:
      mode === 'add' && !callerRoles.includes('SystemAdmin')
        ? 'City Lead, Staff and System Admin can only be granted by a System Admin.'
        : undefined,
    submit: (role) => changeRole(rolesService, target.id, mode, role as Role, changed),
  };
  dialogs.open(RoleDialogComponent, { data });
}

/** Resolves to null once `changed` has the new roles, or to the server's refusal. */
async function changeRole(
  rolesService: RolesService,
  id: string,
  mode: RoleMode,
  role: Role,
  changed: (roles: Role[]) => void,
): Promise<string | null> {
  try {
    const call =
      mode === 'add' ? rolesService.addRole(id, role) : rolesService.removeRole(id, role);
    changed(await firstValueFrom(call));
    return null;
  } catch (error) {
    if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 409)) {
      return problemDetails(error)?.detail ?? 'You can’t make that change.';
    }
    throw error;
  }
}
