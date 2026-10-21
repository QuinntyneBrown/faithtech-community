/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/admin/audit-log
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the audit log API. Pages depend on AUDIT_LOG_SERVICE, never on HttpAuditLogService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface AuditLogService {}

export const AUDIT_LOG_SERVICE = new InjectionToken<AuditLogService>('AUDIT_LOG_SERVICE');
