import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { HttpReportsService } from './http-reports.service';
import { REPORTS_SERVICE } from './reports.service';

describe('HttpReportsService', () => {
  let service: HttpReportsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: REPORTS_SERVICE, useClass: HttpReportsService },
      ],
    });
    service = TestBed.inject(REPORTS_SERVICE) as HttpReportsService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('gets the report for the filters, leaving 403 and failures to the page', () => {
    service.getReport({ chapter: 'c-toronto', period: 'this-year' }).subscribe();

    const req = controller.expectOne('/api/reports?chapter=c-toronto&period=this-year');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush({});
  });

  it('sends an empty chapter for All chapters', () => {
    service.getReport({ chapter: null, period: 'last-30-days' }).subscribe();

    controller.expectOne('/api/reports?chapter=&period=last-30-days').flush({});
  });

  it('downloads the CSV for the same filters as a blob, leaving failures to the page', () => {
    service.exportCsv({ chapter: 'c-toronto', period: 'all-time' }).subscribe();

    const req = controller.expectOne('/api/reports/export.csv?chapter=c-toronto&period=all-time');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush(new Blob(['csv']));
  });
});
