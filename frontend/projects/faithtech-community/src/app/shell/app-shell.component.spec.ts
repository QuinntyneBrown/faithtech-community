// Traces to: L2-027
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  AUTH_SERVICE,
  NOTIFICATIONS_SERVICE,
  NotificationDto,
  NotificationPage,
} from '@faithtech-community/api';
import { of, Subject } from 'rxjs';

import { AppShellComponent } from './app-shell.component';

function notice(overrides: Partial<NotificationDto>): NotificationDto {
  return {
    id: 'n1',
    kind: 'Announcement',
    title: 'Hannah Kim sent “Builders Night moves to Kestrel Labs”',
    linkPath: '/announcements',
    actorName: 'Hannah Kim',
    createdAt: '2026-10-17T09:00:00Z',
    readAt: null,
    ...overrides,
  };
}

const ITEMS = [
  notice({}),
  notice({ id: 'n2', title: 'Your roles changed', linkPath: '/people/me', actorName: null }),
  notice({ id: 'n3', title: 'Read one', readAt: '2026-10-16T09:00:00Z' }),
];

async function setup(unread = 2, items = ITEMS) {
  const service = {
    unreadCount: vi.fn(() => of(unread)),
    list: vi.fn(() =>
      of<NotificationPage>({ items, unreadCount: unread, page: 1, pageSize: 20, totalCount: 3 }),
    ),
    markRead: vi.fn(() => of(undefined)),
    markAllRead: vi.fn(() => of(undefined)),
    readChanged: new Subject<void>(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: NOTIFICATIONS_SERVICE, useValue: service },
      {
        provide: AUTH_SERVICE,
        useValue: {
          currentUser: signal({ name: 'Grace Okonkwo', profileId: 'p1', emailVerified: true }),
          roles: signal(['CityLead']),
          signOut: () => of(undefined),
          resendVerification: () => of(undefined),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(AppShellComponent);
  document.body.appendChild(fixture.nativeElement);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const bell = () => document.querySelector<HTMLButtonElement>('button.ft-notification-bell')!;
  const panel = () => document.querySelector('.cdk-overlay-container [role="dialog"]');
  const button = (label: string) =>
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const open = async () => {
    bell().click();
    await settle();
  };
  return { fixture, service, settle, bell, panel, button, open, router: TestBed.inject(Router) };
}

describe('AppShellComponent notifications bell', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('shows the unread count on the bell', async () => {
    const { bell, service } = await setup(2);

    expect(service.unreadCount).toHaveBeenCalled();
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 2 unread');
  });

  it('opens a panel listing the latest notifications newest first, as the API orders them', async () => {
    const { open, panel, service } = await setup();

    await open();

    expect(service.list).toHaveBeenCalledWith(1);
    const items = Array.from(panel()!.querySelectorAll('li'));
    expect(items.map((li) => li.querySelector('a')!.textContent!.trim())).toEqual([
      'Hannah Kim sent “Builders Night moves to Kestrel Labs”',
      'Your roles changed',
      'Read one',
    ]);
    expect(items[0].textContent).toContain('Unread');
    expect(items[2].textContent).not.toContain('Unread');
    expect(items[0].querySelector('.ft-avatar')!.textContent!.trim()).toBe('HK');
  });

  it('marks an opened notification read, closes the panel and goes to its item', async () => {
    const { open, panel, service, router, bell, settle } = await setup(2);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    await open();

    panel()!
      .querySelectorAll('li a')[1]
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();

    expect(service.markRead).toHaveBeenCalledWith('n2');
    expect(navigate).toHaveBeenCalledWith('/people/me');
    expect(panel()).toBeNull();
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 1 unread');
  });

  it('clears the count with Mark all read', async () => {
    const { open, button, service, bell, settle } = await setup(2);
    await open();

    button('Mark all read')!.click();
    await settle();

    expect(service.markAllRead).toHaveBeenCalled();
    expect(bell().getAttribute('aria-label')).toBe('Notifications');
  });

  it('reads the count again when notices are marked read elsewhere, such as on the Notifications page', async () => {
    const { service, fixture } = await setup();
    const before = service.unreadCount.mock.calls.length;

    service.readChanged.next();
    await fixture.whenStable();

    expect(service.unreadCount.mock.calls.length).toBe(before + 1);
  });

  it('reads the count again after each navigation and every minute', async () => {
    vi.useFakeTimers();
    const { service, router, settle } = await setup();
    const calls = service.unreadCount.mock.calls.length;

    await router.navigateByUrl('/team');
    await settle();
    expect(service.unreadCount.mock.calls.length).toBe(calls + 1);

    vi.advanceTimersByTime(60_000);
    expect(service.unreadCount.mock.calls.length).toBe(calls + 2);
  });
});
