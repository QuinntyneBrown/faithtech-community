/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/audit-log
 */
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

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

  it.each([
    ['unfiltered', () => service.getEntries({}), '/api/admin/audit?page=1'],
    [
      'filtered',
      () =>
        service.getEntries(
          { actor: 'a1', action: 'role.add', from: '2026-01-01', to: '2026-02-01' },
          3,
        ),
      '/api/admin/audit?actor=a1&action=role.add&from=2026-01-01&to=2026-02-01&page=3',
    ],
  ])('gets entries %s', (_name, call, url) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });
});
