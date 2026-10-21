/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/announcements/send-announcement
 *   - docs/detailed-designs/announcements/read-announcements-and-opt-out
 */
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
      .countRecipients({ kind: 'Role', role: 'Volunteer', eventId: null })
      .subscribe((c) => (count = c));

    const req = controller.expectOne('/api/announcements/recipient-count');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kind: 'Role', role: 'Volunteer', eventId: null });
    req.flush({ count: 12 });
    expect(count).toBe(12);
  });

  it.each([
    ['list', () => service.list(), 'GET', '/api/announcements?page=1', undefined],
    [
      'send',
      () =>
        service.send({
          subject: 'Hi',
          body: 'All',
          audience: { kind: 'Everyone', role: null, eventId: null },
        }),
      'POST',
      '/api/announcements',
      { subject: 'Hi', body: 'All', audience: { kind: 'Everyone', role: null, eventId: null } },
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
