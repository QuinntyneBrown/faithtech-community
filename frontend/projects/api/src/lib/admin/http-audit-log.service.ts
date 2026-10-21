import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { PagedResult, toHttpParams } from '../shared';
import { AuditEntry, AuditFilters, AuditLogService } from './audit-log.service';

@Injectable()
export class HttpAuditLogService implements AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/admin/audit`;

  getEntries(filters: AuditFilters, page = 1): Observable<PagedResult<AuditEntry>> {
    return this.http.get<PagedResult<AuditEntry>>(this.base, {
      params: toHttpParams({ ...filters, page }),
    });
  }

  exportCsv(filters: AuditFilters): Observable<Blob> {
    return this.http.get(`${this.base}/export`, {
      params: toHttpParams({ ...filters }),
      responseType: 'blob',
    });
  }
}
