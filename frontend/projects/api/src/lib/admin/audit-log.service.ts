import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult } from '../shared';

/**
 * Audit log categories (L2-041 AC2, L2-152 AC2); each maps onto a set of actions on the server. `roles` holds role
 * changes, role definitions and grant rules.
 */
export type AuditCategory =
  'roles' | 'suspensions' | 'contacts' | 'deletions' | 'organisation' | 'chapters' | 'taxonomies';

export interface AuditEntry {
  id: string;
  occurredAtUtc: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  /** One line saying what happened, e.g. "Granted City Lead to Esther Nakamura". */
  summary: string;
  before: string | null;
  after: string | null;
  ipAddress: string;
}

export interface AuditFilters {
  category?: AuditCategory | null;
  actor?: string;
  /** ISO dates; without `from` the server shows the last 90 days. */
  from?: string;
  to?: string;
}

/** Contract for the read-only audit log. Pages depend on AUDIT_LOG_SERVICE, never on HttpAuditLogService. */
export interface AuditLogService {
  /**
   * 50 entries per page, newest first. An administrator reads everything; a holder of ManageRoles or
   * ManageOrganisationSettings only the categories they may change; anyone else, or a category outside that, is 403.
   */
  getEntries(filters: AuditFilters, page?: number): Observable<PagedResult<AuditEntry>>;
  /** Every filtered entry as CSV (L2-041 AC5). */
  exportCsv(filters: AuditFilters): Observable<Blob>;
}

export const AUDIT_LOG_SERVICE = new InjectionToken<AuditLogService>('AUDIT_LOG_SERVICE');
