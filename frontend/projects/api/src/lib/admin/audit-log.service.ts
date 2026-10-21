/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/audit-log
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult } from '../shared';

export interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson: string;
  afterJson: string;
  occurredAt: string;
  ipAddress: string;
}

export interface AuditFilters {
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
}

/**
 * Contract for the read-only audit log. Pages depend on AUDIT_LOG_SERVICE, never on HttpAuditLogService.
 * 50 entries per page, newest first. TODO(slice): L2-041 also wants a category filter, a 90-day default
 * range and CSV export, none of which the design covers.
 */
export interface AuditLogService {
  getEntries(filters: AuditFilters, page?: number): Observable<PagedResult<AuditEntry>>;
}

export const AUDIT_LOG_SERVICE = new InjectionToken<AuditLogService>('AUDIT_LOG_SERVICE');
