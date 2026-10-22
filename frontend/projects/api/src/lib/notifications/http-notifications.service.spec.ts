// Traces to: L2-027
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpNotificationsService } from './http-notifications.service';
import { NOTIFICATIONS_SERVICE, NotificationPage } from './notifications.service';

describe('HttpNotificationsService', () => {
  let service: HttpNotificationsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: NOTIFICATIONS_SERVICE, useClass: HttpNotificationsService },
      ],
    });
    service = TestBed.inject(NOTIFICATIONS_SERVICE) as HttpNotificationsService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('lists the first page of every notification by default', () => {
    const page: NotificationPage = {
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      unreadCount: 0,
      hasMore: false,
    };
    let result: NotificationPage | undefined;
    service.list().subscribe((p) => (result = p));

    const req = controller.expectOne('/api/notifications?page=1');
    expect(req.request.method).toBe('GET');
    req.flush(page);
    expect(result).toEqual(page);
  });

  it('lists a later page of unread notifications', () => {
    service.list({ page: 3, unreadOnly: true }).subscribe();

    controller.expectOne('/api/notifications?page=3&unreadOnly=true').flush(null);
  });

  it('reads the unread count', () => {
    let count = -1;
    service.unreadCount().subscribe((c) => (count = c));

    controller.expectOne('/api/notifications/unread-count').flush({ count: 4 });
    expect(count).toBe(4);
  });

  it('marks one and all as read', () => {
    service.markRead('n1').subscribe();
    const one = controller.expectOne('/api/notifications/n1/read');
    expect(one.request.method).toBe('POST');
    one.flush(null);

    service.markAllRead().subscribe();
    const all = controller.expectOne('/api/notifications/read-all');
    expect(all.request.method).toBe('POST');
    all.flush(null);
  });
});
