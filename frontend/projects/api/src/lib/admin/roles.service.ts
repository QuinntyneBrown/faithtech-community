/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/assign-roles
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

/**
 * Contract for role assignment. Pages depend on ROLES_SERVICE, never on HttpRolesService.
 * City Leads may change EventLead, CreateLead, CommunicationsLead, Volunteer, ProductEngineer and Attendee;
 * only System Admin may change CityLead, Staff and SystemAdmin. The server enforces this (403), and
 * removing the last System Admin is refused (409).
 */
export interface RolesService {
  addRole(profileId: string, role: Role): Observable<Role[]>;
  removeRole(profileId: string, role: Role): Observable<Role[]>;
}

export const ROLES_SERVICE = new InjectionToken<RolesService>('ROLES_SERVICE');
