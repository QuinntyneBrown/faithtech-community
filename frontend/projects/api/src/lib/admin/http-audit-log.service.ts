/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/audit-log
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { PagedResult, toHttpParams } from '../shared';
import { AuditEntry, AuditFilters, AuditLogService } from './audit-log.service';

@Injectable()
export class HttpAuditLogService implements AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  getEntries(filters: AuditFilters, page = 1): Observable<PagedResult<AuditEntry>> {
    return this.http.get<PagedResult<AuditEntry>>(`${this.base}/admin/audit`, {
      params: toHttpParams({ ...filters, page }),
    });
  }
}
