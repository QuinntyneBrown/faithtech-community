// Traces to: L2-027
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  NOTIFICATIONS_SERVICE,
  NotificationDto,
  NotificationPage,
  NotificationQuery,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { NotificationsPage } from './notifications.page';

function notification(id: string, overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id,
    kind: 'WorkItemAssigned',
    title: `Notice ${id}`,
    linkPath: `/items/${id}`,
    createdAt: '2026-10-20T09:30:00Z',
    readAt: null,
    actorId: 'p1',
    actorName: 'Samuel Mensah',
    ...overrides,
  };
}

function page(items: NotificationDto[], extra: Partial<NotificationPage> = {}): NotificationPage {
  return {
    items,
    page: 1,
    pageSize: 50,
    totalCount: items.length,
    unreadCount: items.filter((n) => !n.readAt).length,
    hasMore: false,
    ...extra,
  };
}

async function setup(list: (query: NotificationQuery) => Observable<NotificationPage>) {
  const service = {
    list: vi.fn(list),
    unreadCount: vi.fn(() => of(0)),
    markRead: vi.fn(() => of(undefined)),
    markAllRead: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: NOTIFICATIONS_SERVICE, useValue: service }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(NotificationsPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const rows = () => Array.from(host.querySelectorAll('li.ft-notice'));
  const click = async (label: string) => {
    button(label)!.click();
    await settle();
  };
  return { fixture, host, service, navigate, button, rows, click, settle };
}

describe('NotificationsPage', () => {
  it('lists notifications newest first with the unread count and the page actions', async () => {
    const { host, rows, button } = await setup(() =>
      of(page([notification('a'), notification('b', { readAt: '2026-10-21T00:00:00Z' })])),
    );

    expect(host.querySelector('h1')!.textContent).toContain('Notifications');
    expect(host.textContent).toContain('1 unread');
    expect(rows().map((r) => r.querySelector('a')!.textContent!.trim())).toEqual([
      'Notice a',
      'Notice b',
    ]);
    expect(button('Mark all as read')).toBeDefined();
    expect(host.querySelector('a[href="/settings"]')).not.toBeNull();
    expect(button('All')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the empty state when there are none', async () => {
    const { host, rows, button } = await setup(() => of(page([])));

    expect(rows()).toHaveLength(0);
    expect(host.textContent).toContain('You’re all caught up');
    expect(button('Mark all as read')).toBeUndefined();
  });

  it('lists only unread notifications under Unread, and everything again under All', async () => {
    const { service, click, button } = await setup((q) =>
      of(page(q.unreadOnly ? [notification('a')] : [notification('a'), notification('b')])),
    );

    await click('Unread');
    expect(service.list).toHaveBeenLastCalledWith({ page: 1, unreadOnly: true });
    expect(button('Unread')!.getAttribute('aria-pressed')).toBe('true');

    await click('All');
    expect(service.list).toHaveBeenLastCalledWith({ page: 1, unreadOnly: false });
  });

  it('appends the next 50 with Show older notifications and drops the button at the end', async () => {
    const first = Array.from({ length: 50 }, (_, i) => notification(`n${i}`));
    const { rows, click, button, service } = await setup((q) =>
      q.page === 2
        ? of(page([notification('last')], { page: 2, totalCount: 51 }))
        : of(page(first, { hasMore: true, totalCount: 51 })),
    );
    expect(rows()).toHaveLength(50);

    await click('Show older notifications');

    expect(service.list).toHaveBeenLastCalledWith({ page: 2, unreadOnly: false });
    expect(rows()).toHaveLength(51);
    expect(button('Show older notifications')).toBeUndefined();
  });

  it('marks an opened notification read and goes to its item', async () => {
    const { host, service, navigate, settle } = await setup(() => of(page([notification('a')])));

    host.querySelector<HTMLAnchorElement>('li a')!.click();
    await settle();

    expect(service.markRead).toHaveBeenCalledWith('a');
    expect(navigate).toHaveBeenCalledWith('/items/a');
  });

  it('marks everything read and clears the count', async () => {
    const { host, service, click, rows } = await setup(() => of(page([notification('a')])));

    await click('Mark all as read');

    expect(service.markAllRead).toHaveBeenCalled();
    expect(host.textContent).not.toContain('1 unread');
    expect(rows()[0].textContent).not.toContain('Unread');
  });

  it('offers Try again when the list fails to load', async () => {
    let fail = true;
    const { host, click, rows } = await setup(() =>
      fail ? throwError(() => new Error('offline')) : of(page([notification('a')])),
    );
    expect(host.textContent).toContain('We couldn’t load your notifications');

    fail = false;
    await click('Try again');

    expect(rows()).toHaveLength(1);
  });
});
