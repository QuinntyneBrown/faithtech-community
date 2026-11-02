import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { EVENT_HUBS_SERVICE } from './event-hubs.service';
import { HttpEventHubsService } from './http-event-hubs.service';

// Traces to: L2-153 AC3, AC7; L2-154 AC1, AC4; L2-156 AC4; L2-157 AC2; L2-182 AC3; L2-196 AC3, AC5.
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

  // L2-189 AC3, AC4: the update is set and cleared on the hub, keeping failures on screen.
  it.each([
    [
      'setUpdate',
      () => service.setUpdate('e1', 'Dinner is in the courtyard.'),
      'PUT',
      { text: 'Dinner is in the courtyard.' },
    ],
    ['clearUpdate', () => service.clearUpdate('e1'), 'DELETE', null],
  ])('%s calls the hub’s update', (_name, call, method, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne('/api/events/e1/hub/update');
    expect(req.request.method).toBe(method);
    expect(req.request.body).toEqual(body);
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush(null);
  });

  // L2-190 AC3: a move posts the row, its new time and whether later rows follow.
  it('moves a session on the hub’s agenda', () => {
    const move = { index: 2, startsAt: '2026-11-07T01:30:00.000Z', shiftLater: true };
    service.moveSession('e1', move).subscribe();

    const req = controller.expectOne('/api/events/e1/hub/agenda/move');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(move);
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

  it('saves one section’s content at its kind, keeping failures on screen', () => {
    service.saveSection('e1', 'Hero', { subtitle: 'A night of building' }).subscribe();

    const req = controller.expectOne('/api/events/e1/hub/sections/Hero');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ subtitle: 'A night of building' });
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush(null);
  });

  it('sends the new order of every section', () => {
    service.reorder('e1', ['Agenda', 'Hero']).subscribe();

    const req = controller.expectOne('/api/events/e1/hub/sections/order');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ kinds: ['Agenda', 'Hero'] });
    req.flush(null);
  });

  // L2-196 AC3, AC5: the archive is a blob, asked for in the browser's time zone, keeping failures on screen.
  it('asks for the hub archive as a blob in the given time zone', () => {
    let received: Blob | undefined;
    service.archive('e1', 'America/Toronto').subscribe((blob) => (received = blob));

    const req = controller.expectOne(
      (r) =>
        r.url === '/api/events/e1/hub/archive' && r.params.get('timeZone') === 'America/Toronto',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    req.flush(new Blob(['PK']));
    expect(received).toBeInstanceOf(Blob);
  });

  it('names a hub file, and its thumbnail, under the event’s hub', () => {
    expect(service.fileUrl('e1', 'r1')).toMatch(/\/events\/e1\/hub\/files\/r1$/);
    expect(service.fileUrl('e1', 'r1', true)).toMatch(/\/events\/e1\/hub\/files\/r1\/thumbnail$/);
  });
});
