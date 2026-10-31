import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { EVENTS_SERVICE, EventRequest } from './events.service';
import { HttpEventsService } from './http-events.service';

const event: EventRequest = {
  title: 'Builders night',
  description: 'Hack',
  type: 'BuildersNight',
  startsAt: '2026-11-01T18:00:00Z',
  endsAt: '2026-11-01T20:00:00Z',
  chapterId: 'c-toronto',
  format: 'InPerson',
  venue: 'HQ',
  onlineLink: null,
  capacity: 60,
  visibility: 'MembersOnly',
};

describe('HttpEventsService', () => {
  let service: HttpEventsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...apiTestProviders(), { provide: EVENTS_SERVICE, useClass: HttpEventsService }],
    });
    service = TestBed.inject(EVENTS_SERVICE) as HttpEventsService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['listEvents', () => service.listEvents({}), 'GET', '/api/events', undefined],
    [
      'listEvents by city',
      () => service.listEvents({ city: 'Toronto' }),
      'GET',
      '/api/events?city=Toronto',
      undefined,
    ],
    [
      'listEvents by filter and city',
      () => service.listEvents({ filter: 'Past', city: 'Austin' }),
      'GET',
      '/api/events?filter=Past&city=Austin',
      undefined,
    ],
    ['getEvent', () => service.getEvent('e1'), 'GET', '/api/events/e1', undefined],
    ['createEvent', () => service.createEvent(event), 'POST', '/api/events', event],
    ['updateEvent', () => service.updateEvent('e1', event), 'PUT', '/api/events/e1', event],
    [
      'cancelEvent',
      () => service.cancelEvent('e1', 'Venue closed'),
      'POST',
      '/api/events/e1/cancel',
      { reason: 'Venue closed' },
    ],
    ['rsvp', () => service.rsvp('e1'), 'POST', '/api/events/e1/rsvps', undefined],
    ['cancelRsvp', () => service.cancelRsvp('e1'), 'DELETE', '/api/events/e1/rsvps/me', undefined],
    [
      'downloadCalendar',
      () => service.downloadCalendar('e1'),
      'GET',
      '/api/events/e1/calendar.ics',
      undefined,
    ],
    ['exportRsvps', () => service.exportRsvps('e1'), 'GET', '/api/events/e1/rsvps.csv', undefined],
    [
      'getPublicEvent',
      () => service.getPublicEvent('e1'),
      'GET',
      '/api/public/events/e1',
      undefined,
    ],
    [
      'rsvpAsGuest',
      () => service.rsvpAsGuest('e1', { name: 'Guest', email: 'g@h.io' }),
      'POST',
      '/api/public/events/e1/rsvps',
      { name: 'Guest', email: 'g@h.io' },
    ],
    [
      'cancelGuestRsvp',
      () => service.cancelGuestRsvp('e1', 'secret'),
      'POST',
      '/api/public/events/e1/rsvps/cancel',
      { token: 'secret' },
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('builds calendar download urls for members and for public events', () => {
    expect(service.calendarUrl('e1')).toBe('/api/events/e1/calendar.ics');
    expect(service.calendarUrl('e1', { isPublic: true })).toBe(
      '/api/public/events/e1/calendar.ics',
    );
  });
});
