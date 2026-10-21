/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/admin-users-and-override
 *   - docs/detailed-designs/admin/suspend-users
 *   - docs/detailed-designs/admin/assign-roles
 *   - docs/detailed-designs/admin/audit-log
 */
export * from './admin-users.service';
export * from './http-admin-users.service';
export * from './audit-log.service';
export * from './http-audit-log.service';
export * from './roles.service';
export * from './http-roles.service';
