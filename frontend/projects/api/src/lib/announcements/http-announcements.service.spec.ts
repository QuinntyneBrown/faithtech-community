import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpAnnouncementsService } from './http-announcements.service';
import { ANNOUNCEMENTS_SERVICE } from './announcements.service';

describe('HttpAnnouncementsService', () => {
  let service: HttpAnnouncementsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: ANNOUNCEMENTS_SERVICE, useClass: HttpAnnouncementsService },
      ],
    });
    service = TestBed.inject(ANNOUNCEMENTS_SERVICE) as HttpAnnouncementsService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('counts recipients for an audience', () => {
    let count = -1;
    service
      .countRecipients({ kind: 'Roles', roles: ['Volunteer', 'Attendee'] })
      .subscribe((c) => (count = c));

    const req = controller.expectOne('/api/announcements/recipient-count');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kind: 'Roles', roles: ['Volunteer', 'Attendee'] });
    req.flush({ count: 12 });
    expect(count).toBe(12);
  });

  it('reads the caller’s announcement email opt-out', () => {
    let optedOut: boolean | null = null;
    service.emailOptOut().subscribe((value) => (optedOut = value));

    const req = controller.expectOne('/api/me/announcement-email-opt-out');
    expect(req.request.method).toBe('GET');
    req.flush({ optedOut: true });
    expect(optedOut).toBe(true);
  });

  it.each([
    ['list', () => service.list(), 'GET', '/api/announcements?page=1', undefined],
    ['list page 2', () => service.list(2), 'GET', '/api/announcements?page=2', undefined],
    [
      'send',
      () =>
        service.send({
          subject: 'Hi',
          body: 'All',
          audience: { kind: 'Everyone' },
          alsoEmail: true,
        }),
      'POST',
      '/api/announcements',
      { subject: 'Hi', body: 'All', audience: { kind: 'Everyone' }, alsoEmail: true },
    ],
    [
      'setEmailOptOut',
      () => service.setEmailOptOut(true),
      'PUT',
      '/api/me/announcement-email-opt-out',
      { optedOut: true },
    ],
    [
      'unsubscribe',
      () => service.unsubscribe('tok'),
      'POST',
      '/api/announcements/unsubscribe',
      { token: 'tok' },
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });
});
