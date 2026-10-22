// Traces to: L2-049
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { ACTIVITY_SERVICE, ActivityItemDto } from './activity.service';
import { HttpActivityService } from './http-activity.service';

describe('HttpActivityService', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: ACTIVITY_SERVICE, useClass: HttpActivityService },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  it('reads the caller’s recent activity', () => {
    const body: ActivityItemDto[] = [
      {
        id: 'n1',
        kind: 'ContactSignedUp',
        text: 'Tomás Ortega just joined FaithTech',
        linkPath: '/contacts/c1',
        occurredAt: '2026-10-21T15:42:00Z',
      },
    ];
    let result: ActivityItemDto[] | undefined;
    TestBed.inject(ACTIVITY_SERVICE)
      .recent()
      .subscribe((r) => (result = r));

    const req = controller.expectOne('/api/activity');
    expect(req.request.method).toBe('GET');
    req.flush(body);
    expect(result).toEqual(body);
  });
});
