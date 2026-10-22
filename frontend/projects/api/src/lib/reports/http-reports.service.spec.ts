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
    service.getReport({ city: 'Toronto', period: 'this-year' }).subscribe();

    const req = controller.expectOne('/api/reports?city=Toronto&period=this-year');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush({});
  });

  it('sends an empty city for All cities', () => {
    service.getReport({ city: null, period: 'last-30-days' }).subscribe();

    controller.expectOne('/api/reports?city=&period=last-30-days').flush({});
  });
});
