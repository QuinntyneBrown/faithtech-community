// Traces to: L2-027
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NOTIFICATIONS_SERVICE, NotificationDto, NotificationPage } from '@faithtech-community/api';
import { of } from 'rxjs';

import { ShellNotificationsComponent } from './shell-notifications.component';

function notification(overrides: Partial<NotificationDto>): NotificationDto {
  return {
    id: 'n1',
    kind: 'ContactSignedUp',
    title: 'Tomás Ortega just joined FaithTech',
    linkPath: '/contacts/c1',
    createdAt: new Date().toISOString(),
    readAt: null,
    actorId: 'p9',
    actorName: 'Tomás Ortega',
    ...overrides,
  };
}

function page(items: NotificationDto[]): NotificationPage {
  return {
    items,
    page: 1,
    pageSize: 50,
    totalCount: items.length,
    unreadCount: items.filter((n) => !n.readAt).length,
    hasMore: false,
  };
}

async function setup(items: NotificationDto[]) {
  let current = items;
  const service = {
    list: vi.fn(() => of(page(current))),
    unreadCount: vi.fn(() => of(current.filter((n) => !n.readAt).length)),
    markRead: vi.fn((id: string) => {
      current = current.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
      return of(undefined);
    }),
    markAllRead: vi.fn(() => {
      current = current.map((n) => ({ ...n, readAt: new Date().toISOString() }));
      return of(undefined);
    }),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: NOTIFICATIONS_SERVICE, useValue: service }],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ShellNotificationsComponent);
  document.body.appendChild(fixture.nativeElement);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const bell = () =>
    fixture.nativeElement.querySelector('button.ft-notification-bell') as HTMLButtonElement;
  const panel = () => document.querySelector('.cdk-overlay-container [role="dialog"]');
  const open = async () => {
    bell().click();
    await settle();
  };
  return { fixture, service, navigate, bell, panel, open, settle };
}

describe('ShellNotificationsComponent', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows the unread count on the bell', async () => {
    const { bell, service } = await setup([notification({}), notification({ id: 'n2' })]);

    expect(service.list).toHaveBeenCalled();
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 2 unread');
  });

  it('lists the latest notices in the panel, newest first, with who raised them', async () => {
    const { open, panel } = await setup([
      notification({ id: 'n1', title: 'Newest' }),
      notification({
        id: 'n2',
        title: 'Older',
        actorName: null,
        actorId: null,
        readAt: '2026-10-01',
      }),
    ]);

    await open();

    const rows = Array.from(panel()!.querySelectorAll('li'));
    expect(rows.map((r) => r.querySelector('a')!.textContent!.trim())).toEqual(['Newest', 'Older']);
    expect(rows[0].querySelector('.ft-avatar')!.textContent!.trim()).toBe('TO');
    expect(rows[0].textContent).toContain('Unread');
    expect(rows[1].textContent).not.toContain('Unread');
  });

  it('marks an opened notice read and then goes to its item', async () => {
    const { open, panel, service, navigate, bell, settle } = await setup([notification({})]);
    await open();

    panel()!.querySelector<HTMLAnchorElement>('li a')!.click();
    await settle();

    expect(service.markRead).toHaveBeenCalledWith('n1');
    expect(navigate).toHaveBeenCalledWith('/contacts/c1');
    expect(bell().getAttribute('aria-label')).toBe('Notifications');
  });

  it('clears the count with Mark all read', async () => {
    const { open, panel, service, bell, settle } = await setup([
      notification({}),
      notification({ id: 'n2' }),
    ]);
    await open();

    Array.from(panel()!.querySelectorAll('button'))
      .find((b) => b.textContent!.includes('Mark all read'))!
      .click();
    await settle();

    expect(service.markAllRead).toHaveBeenCalled();
    expect(bell().getAttribute('aria-label')).toBe('Notifications');
  });
});
