import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { INVITES_SERVICE, InviteDto } from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { SendInviteDialog } from '../../dialogs';
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

async function setup(list: () => Observable<InviteDto[]>, dialogResult?: InviteDto) {
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
    const { host, items } = await setup(() => of([pending, accepted, expired]));

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
      of([pending, accepted, expired]),
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
    const { dialogs, toasts, button, items, settle } = await setup(() => of([accepted]), sent);

    button('Invite someone')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(SendInviteDialog, expect.anything());
    expect(items()[0]).toContain('new.person@example.org');
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ heading: 'Invite sent to new.person@example.org' }),
    );
  });

  it('shows the empty state with an invite action', async () => {
    const { host, button } = await setup(() => of([]));
    expect(host.textContent).toContain('No invites sent');
    expect(button('Invite someone')).toBeDefined();
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
