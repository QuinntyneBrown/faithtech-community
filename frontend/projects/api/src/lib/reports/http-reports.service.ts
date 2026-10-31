import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { ReportDto, ReportFilters, ReportsService } from './reports.service';

@Injectable()
export class HttpReportsService implements ReportsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  /** The page shows its own forbidden and error states (docs/mocks/pages/reports). */
  private readonly page = new HttpContext()
    .set(HANDLES_FORBIDDEN, true)
    .set(HANDLES_SERVER_ERROR, true);

  getReport(filters: ReportFilters): Observable<ReportDto> {
    return this.http.get<ReportDto>(`${this.api}/reports`, {
      params: this.params(filters),
      context: this.page,
    });
  }

  exportCsv(filters: ReportFilters): Observable<Blob> {
    return this.http.get(`${this.api}/reports/export.csv`, {
      params: this.params(filters),
      responseType: 'blob',
      context: this.page,
    });
  }

  private params(filters: ReportFilters): HttpParams {
    return new HttpParams().set('chapter', filters.chapter ?? '').set('period', filters.period);
  }
}
