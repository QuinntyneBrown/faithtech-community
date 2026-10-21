import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpNotificationsService } from './http-notifications.service';
import { NOTIFICATIONS_SERVICE } from './notifications.service';

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

  it('lists the first page by default', () => {
    service.list().subscribe();

    const req = controller.expectOne('/api/notifications?page=1');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], unreadCount: 0, page: 1, pageSize: 20, totalCount: 0 });
  });

  it('lists a given page', () => {
    service.list(3).subscribe();

    controller.expectOne('/api/notifications?page=3').flush(null);
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
