import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { EVENT_HUBS_SERVICE } from './event-hubs.service';
import { HttpEventHubsService } from './http-event-hubs.service';

// Traces to: L2-153 AC3, AC7; L2-154 AC1, AC4.
describe('HttpEventHubsService', () => {
  let service: HttpEventHubsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: EVENT_HUBS_SERVICE, useClass: HttpEventHubsService },
      ],
    });
    service = TestBed.inject(EVENT_HUBS_SERVICE) as HttpEventHubsService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['create', () => service.create('e1'), 'POST'],
    ['get', () => service.get('e1'), 'GET'],
    [
      'save',
      () =>
        service.save('e1', {
          templateKey: 'blank',
          sections: [{ kind: 'Giving', visible: false }],
        }),
      'PUT',
    ],
  ])('%s calls the hub of the event, keeping failures on screen', (_name, call, method) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne('/api/events/e1/hub');
    expect(req.request.method).toBe(method);
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush(null);
  });

  it('lets the hub home show its own forbidden state', () => {
    service.get('e1').subscribe();

    const req = controller.expectOne('/api/events/e1/hub');
    expect(req.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
    req.flush(null);
  });

  it('sends the starting point and section visibility', () => {
    service
      .save('e1', { templateKey: 'blank', sections: [{ kind: 'People', visible: false }] })
      .subscribe();

    const req = controller.expectOne('/api/events/e1/hub');
    expect(req.request.body).toEqual({
      templateKey: 'blank',
      sections: [{ kind: 'People', visible: false }],
    });
    req.flush(null);
  });
});
