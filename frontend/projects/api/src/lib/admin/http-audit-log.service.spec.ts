import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpAuditLogService } from './http-audit-log.service';
import { AUDIT_LOG_SERVICE } from './audit-log.service';

describe('HttpAuditLogService', () => {
  let service: HttpAuditLogService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: AUDIT_LOG_SERVICE, useClass: HttpAuditLogService },
      ],
    });
    service = TestBed.inject(AUDIT_LOG_SERVICE) as HttpAuditLogService;
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it.each([
    ['unfiltered', () => service.getEntries({}), '/api/admin/audit?page=1'],
    [
      'by category',
      () => service.getEntries({ category: 'suspensions' }, 2),
      '/api/admin/audit?category=suspensions&page=2',
    ],
    [
      'by actor and range',
      () => service.getEntries({ actor: 'a1', from: '2026-01-01', to: '2026-02-01' }, 3),
      '/api/admin/audit?actor=a1&from=2026-01-01&to=2026-02-01&page=3',
    ],
  ])('gets entries %s', (_name, call, url) => {
    call().subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], page: 1, pageSize: 50, totalCount: 0 });
  });

  it('exports the filtered entries as a CSV blob', () => {
    let blob: Blob | null = null;
    service.exportCsv({ category: 'roles' }).subscribe((b) => (blob = b));

    const req = controller.expectOne('/api/admin/audit/export?category=roles');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['When (UTC)\n'], { type: 'text/csv' }));
    expect(blob).not.toBeNull();
  });
});
