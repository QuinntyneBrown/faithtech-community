// Traces to: L2-027
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NOTIFICATIONS_SERVICE, NotificationDto, NotificationPage } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { NotificationsPage } from './notifications.page';

function notice(id: string, overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id,
    kind: 'Announcement',
    title: `Notice ${id}`,
    linkPath: `/announcements`,
    actorName: 'Hannah Kim',
    createdAt: '2026-10-17T09:00:00Z',
    readAt: null,
    ...overrides,
  };
}

function page(items: NotificationDto[], unreadCount: number, totalCount = items.length, n = 1) {
  return { items, unreadCount, page: n, pageSize: 50, totalCount } satisfies NotificationPage;
}

async function setup(list: (page: number, unreadOnly?: boolean) => Observable<NotificationPage>) {
  const service = {
    list: vi.fn(list),
    unreadCount: vi.fn(() => of(0)),
    markRead: vi.fn(() => of(undefined)),
    markAllRead: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: NOTIFICATIONS_SERVICE, useValue: service },
    ],
  });
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
  const items = () => Array.from(host.querySelectorAll('li'));
  return { fixture, host, service, settle, button, items, router: TestBed.inject(Router) };
}

describe('NotificationsPage', () => {
  it('lists notifications newest first with the unread count and Settings', async () => {
    const { host, items, button } = await setup(() =>
      of(page([notice('a'), notice('b'), notice('c', { readAt: '2026-10-17T10:00:00Z' })], 2)),
    );

    expect(host.querySelector('h1')!.textContent).toContain('Notifications');
    expect(host.textContent).toContain('2 unread');
    expect(items().map((li) => li.querySelector('a')!.textContent!.trim())).toEqual([
      'Notice a',
      'Notice b',
      'Notice c',
    ]);
    expect(button('Mark all as read')).toBeDefined();
    const settings = Array.from(host.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Settings'),
    );
    expect(settings!.getAttribute('href')).toBe('/settings');
  });

  it('marks an opened notification read and goes to its item', async () => {
    const { items, service, router, settle, host } = await setup(() =>
      of(page([notice('a', { linkPath: '/people/me' }), notice('b')], 2)),
    );
    const navigate = vi.spyOn(router, 'navigateByUrl');

    items()[0]
      .querySelector('a')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();

    expect(service.markRead).toHaveBeenCalledWith('a');
    expect(navigate).toHaveBeenCalledWith('/people/me');
    expect(host.textContent).toContain('1 unread');
  });

  it('marks all as read, clearing the count and the action', async () => {
    const { button, service, settle, host, items } = await setup(() =>
      of(page([notice('a'), notice('b')], 2)),
    );

    button('Mark all as read')!.click();
    await settle();

    expect(service.markAllRead).toHaveBeenCalled();
    expect(host.textContent).not.toContain('unread');
    expect(items().some((li) => li.textContent!.includes('Unread'))).toBe(false);
    expect(button('Mark all as read')).toBeUndefined();
  });

  it('shows an empty state when there are none', async () => {
    const { host, button } = await setup(() => of(page([], 0)));

    expect(host.textContent).toContain('You’re all caught up');
    expect(host.querySelector('ul')).toBeNull();
    expect(button('Mark all as read')).toBeUndefined();
  });

  it('appends the next 50 with Show older notifications until none are left', async () => {
    const first = Array.from({ length: 50 }, (_, i) => notice(`a${i}`));
    const { button, service, settle, items } = await setup((n) =>
      of(n === 1 ? page(first, 51, 51) : page([notice('last')], 51, 51, 2)),
    );
    expect(service.list).toHaveBeenCalledWith(1, false);
    expect(items()).toHaveLength(50);

    button('Show older notifications')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith(2, false);
    expect(items()).toHaveLength(51);
    expect(button('Show older notifications')).toBeUndefined();
  });

  it('lists only unread notifications with Unread, and every one again with All', async () => {
    const read = notice('r', { readAt: '2026-10-17T10:00:00Z' });
    const { button, service, settle, items } = await setup((_, unreadOnly) =>
      of(unreadOnly ? page([notice('u')], 1) : page([notice('u'), read], 1)),
    );
    expect(button('All')!.getAttribute('aria-pressed')).toBe('true');

    button('Unread')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith(1, true);
    expect(button('Unread')!.getAttribute('aria-pressed')).toBe('true');
    expect(items()).toHaveLength(1);

    button('All')!.click();
    await settle();

    expect(service.list).toHaveBeenLastCalledWith(1, false);
    expect(items()).toHaveLength(2);
  });

  it('offers Try again when the notifications cannot load', async () => {
    let fail = true;
    const { host, button, settle } = await setup(() =>
      fail ? throwError(() => new Error('offline')) : of(page([notice('a')], 1)),
    );
    expect(host.textContent).toContain('We couldn’t load your notifications');

    fail = false;
    button('Try again')!.click();
    await settle();

    expect(host.textContent).toContain('Notice a');
  });
});
