import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_SERVICE,
  INVITES_SERVICE,
  InviteDto,
  InvitePage,
  Capability,
} from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { MyQrCodeDialog, SendInviteDialog } from '../../dialogs';
import { InvitesPage } from './invites.page';

function invite(overrides: Partial<InviteDto>): InviteDto {
  return {
    id: 'i1',
    email: 'nate.oyelaran@example.org',
    preassignedRole: 'ProductEngineer',
    status: 'Pending',
    invitedByName: 'Grace Okonkwo',
    createdAt: '2026-10-20T12:00:00Z',
    expiresAt: '2026-11-03T12:00:00Z',
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

const pending = invite({});
const accepted = invite({
  id: 'i2',
  email: 'ruth.alvarez@example.org',
  preassignedRole: 'Volunteer',
  status: 'Accepted',
  acceptedAt: '2026-10-18T12:00:00Z',
});
const expired = invite({
  id: 'i3',
  email: 'felix.wu@example.org',
  preassignedRole: 'Attendee',
  status: 'Expired',
  createdAt: '2026-09-17T12:00:00Z',
  expiresAt: '2026-10-01T12:00:00Z',
});

function page(
  items: InviteDto[],
  next: string | null = null,
  totalCount = items.length,
): InvitePage {
  return { items, next, totalCount };
}

async function setup(
  list: (after?: string | null) => Observable<InvitePage>,
  dialogResult?: InviteDto,
  capabilities: Capability[] = ['InviteMembers', 'ConnectLink'],
) {
  const service = {
    listInvites: vi.fn(list),
    resendInvite: vi.fn(() => of(invite({ id: 'i9', email: 'felix.wu@example.org' }))),
  };
  const dialogs = { open: vi.fn(() => ({ closed: of(dialogResult) })) };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: INVITES_SERVICE, useValue: service },
      { provide: DialogService, useValue: dialogs },
      { provide: ToastService, useValue: toasts },
      { provide: AUTH_SERVICE, useValue: { capabilities: signal(capabilities) } },
    ],
  });
  const fixture = TestBed.createComponent(InvitesPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
  const items = () =>
    Array.from(host.querySelectorAll('ft-list-item')).map((i) =>
      i.textContent!.replace(/\s+/g, ' '),
    );
  return { fixture, host, service, dialogs, toasts, button, items, settle };
}

describe('InvitesPage', () => {
  it('lists every invite with its role, dates and status', async () => {
    const { host, items } = await setup(() => of(page([pending, accepted, expired])));

    expect(host.querySelector('h1')!.textContent).toContain('Invites');
    const [first, second, third] = items();
    expect(first).toContain('nate.oyelaran@example.org');
    expect(first).toContain('Product Engineer · Sent Tue 20 Oct · expires Tue 3 Nov');
    expect(first).toContain('Pending');
    expect(second).toContain('Volunteer · Accepted Sun 18 Oct');
    expect(third).toContain('Attendee · Expired Thu 1 Oct');
    expect(third).toContain('Expired');
  });

  it('offers Resend only on expired invites and sends a new one', async () => {
    const { service, toasts, button, items, settle } = await setup(() =>
      of(page([pending, accepted, expired])),
    );
    expect(button('Resend invite to nate.oyelaran@example.org')).toBeUndefined();

    button('Resend invite to felix.wu@example.org')!.click();
    await settle();

    expect(service.resendInvite).toHaveBeenCalledWith('i3');
    expect(items()[0]).toContain('felix.wu@example.org');
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', heading: 'Invite sent again' }),
    );
  });

  it('opens the send dialog and adds the new invite to the top', async () => {
    const sent = invite({ id: 'i8', email: 'new.person@example.org' });
    const { dialogs, toasts, button, items, settle } = await setup(
      () => of(page([accepted])),
      sent,
    );

    button('Invite someone')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(SendInviteDialog, expect.anything());
    expect(items()[0]).toContain('new.person@example.org');
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ heading: 'Invite sent to new.person@example.org' }),
    );
  });

  it.each<[Capability[], boolean]>([
    [['ConnectLink'], true],
    [['AdministerOrganisation'], true],
    [['InviteMembers'], false],
    [['SendAnnouncements', 'JoinWorkspaces'], false],
  ])('with capabilities %j shows My QR code: %s', async (capabilities, shown) => {
    const { button } = await setup(() => of(page([pending])), undefined, capabilities);
    expect(button('My QR code') !== undefined).toBe(shown);
  });

  it('opens My QR code in a dialog', async () => {
    const { dialogs, button, settle } = await setup(() => of(page([pending])));

    button('My QR code')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(MyQrCodeDialog, expect.anything());
  });

  it('shows the empty state with an invite action', async () => {
    const { host, button } = await setup(() => of(page([])));
    expect(host.textContent).toContain('No invites sent');
    expect(button('Invite someone')).toBeDefined();
  });

  it('shows how many invites there are and loads the next page on Show more', async () => {
    const pages: Record<string, InvitePage> = {
      first: page([pending, accepted], 'cursor-2', 3),
      'cursor-2': page([expired]),
    };
    const { host, service, button, items, settle } = await setup((after) =>
      of(pages[after ?? 'first']),
    );
    expect(host.textContent).toContain('Showing 2 of 3 invites');

    button('Show more invites')!.click();
    await settle();

    expect(service.listInvites).toHaveBeenLastCalledWith('cursor-2');
    expect(items()).toHaveLength(3);
    expect(items()[2]).toContain('felix.wu@example.org');
    expect(host.textContent).toContain('Showing 3 of 3 invites');
    expect(button('Show more invites')).toBeUndefined();
  });

  it('keeps the list when the next page fails and lets the lead try again', async () => {
    let fail = true;
    const { host, button, items, settle } = await setup((after) => {
      if (!after) return of(page([pending, accepted], 'cursor-2', 3));
      return fail ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(page([expired]));
    });

    button('Show more invites')!.click();
    await settle();

    expect(items()).toHaveLength(2);
    expect(host.querySelector('[role="alert"]')!.textContent).toContain(
      'We couldn’t load more invites. Try again.',
    );
    fail = false;
    button('Show more invites')!.click();
    await settle();
    expect(items()).toHaveLength(3);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('counts a sent invite in the total without disturbing the next page', async () => {
    const sent = invite({ id: 'i8', email: 'new.person@example.org' });
    const { host, button, settle } = await setup(
      (after) => of(after ? page([expired]) : page([accepted], 'cursor-2', 2)),
      sent,
    );

    button('Invite someone')!.click();
    await settle();

    expect(host.textContent).toContain('Showing 2 of 3 invites');
    expect(button('Show more invites')).toBeDefined();
  });

  it('shows the error state with a retry', async () => {
    const { host, service, button, settle } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    expect(host.textContent).toContain('We couldn’t load invites');
    button('Try again')!.click();
    await settle();
    expect(service.listInvites).toHaveBeenCalledTimes(2);
  });
});
