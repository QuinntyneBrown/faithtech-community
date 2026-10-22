// Traces to: L2-029, L2-030
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpAnnouncementsService } from './http-announcements.service';
import { ANNOUNCEMENTS_SERVICE, AnnouncementSent } from './announcements.service';

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

  it('counts the recipients of an audience', () => {
    let count = -1;
    service
      .countRecipients({ kind: 'Roles', roles: ['Volunteer', 'ProductEngineer'] })
      .subscribe((c) => (count = c));

    const req = controller.expectOne('/api/announcements/recipient-count');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kind: 'Roles', roles: ['Volunteer', 'ProductEngineer'] });
    req.flush({ count: 12 });
    expect(count).toBe(12);
  });

  it('sends an announcement and returns who it reached', () => {
    let sent: AnnouncementSent | undefined;
    service
      .send({
        subject: 'Hi',
        body: 'All',
        alsoEmail: true,
        audience: { kind: 'EventRsvps', eventId: 'e1' },
      })
      .subscribe((s) => (sent = s));

    const req = controller.expectOne('/api/announcements');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      subject: 'Hi',
      body: 'All',
      alsoEmail: true,
      audience: { kind: 'EventRsvps', eventId: 'e1' },
    });
    req.flush({ id: 'a1', recipientCount: 41, emailCount: 38 });
    expect(sent).toEqual({ id: 'a1', recipientCount: 41, emailCount: 38 });
  });

  it('reads the announcement email opt-out', () => {
    let optedOut: boolean | undefined;
    service.getEmailOptOut().subscribe((o) => (optedOut = o));

    const req = controller.expectOne('/api/me/announcement-email-opt-out');
    expect(req.request.method).toBe('GET');
    req.flush({ optedOut: true });
    expect(optedOut).toBe(true);
  });

  it.each([
    ['list', () => service.list(), 'GET', '/api/announcements?page=1', undefined],
    ['list a page', () => service.list(2), 'GET', '/api/announcements?page=2', undefined],
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
