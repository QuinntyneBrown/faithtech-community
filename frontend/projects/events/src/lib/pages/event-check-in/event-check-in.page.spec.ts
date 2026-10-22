// Traces to: L2-093, L2-094 (docs/detailed-designs/events/event-check-in)
import { TestBed } from '@angular/core/testing';
import { CHECK_IN_SERVICE, CheckInAttendeeDto, CheckInDto } from '@faithtech-community/api';
import { ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { EventCheckInPage } from './event-check-in.page';

function attendee(overrides: Partial<CheckInAttendeeDto>): CheckInAttendeeDto {
  return {
    rsvpId: 'r1',
    profileId: 'p1',
    name: 'Ruth Alvarez',
    isGuest: false,
    isWalkIn: false,
    email: null,
    rsvpedAt: new Date(2026, 9, 16, 9).toISOString(),
    checkedInAt: null,
    ...overrides,
  };
}

function checkIn(overrides: Partial<CheckInDto> = {}): CheckInDto {
  return {
    eventId: 'e1',
    title: 'Toronto Builders Night',
    startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
    city: 'Toronto',
    format: 'InPerson',
    venue: 'Kestrel Labs',
    isCancelled: false,
    cancellationReason: null,
    checkInOpensAt: new Date(2026, 10, 5, 18, 30).toISOString(),
    isOpen: true,
    canEdit: true,
    canExport: true,
    going: 2,
    checkedIn: 0,
    walkIns: 0,
    attendees: [
      attendee({}),
      attendee({
        rsvpId: 'r2',
        profileId: null,
        name: 'Abby Brooks',
        isGuest: true,
        email: 'abby.brooks@example.org',
      }),
    ],
    ...overrides,
  };
}

async function setup(save: () => Observable<CheckInAttendeeDto> = () => of(attendee({}))) {
  const service = {
    getCheckIn: vi.fn(() => of(checkIn())),
    checkIn: vi.fn(save),
    undoCheckIn: vi.fn(() => of(undefined)),
  };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: CHECK_IN_SERVICE, useValue: service },
      { provide: ToastService, useValue: toasts },
    ],
  });
  const fixture = TestBed.createComponent(EventCheckInPage);
  fixture.componentRef.setInput('id', 'e1');
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const names = () =>
    Array.from(host.querySelectorAll('ft-list-item .ft-list-item__title')).map((t) =>
      t.textContent?.trim(),
    );
  const toggle = (name: string) =>
    Array.from(host.querySelectorAll<HTMLInputElement>('input[role="switch"]')).find(
      (s) => s.closest('label')?.textContent?.trim() === `Check in ${name}`,
    )!;
  const search = async (term: string) => {
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  return { fixture, host, service, toasts, names, toggle, search, settle };
}

describe('EventCheckInPage', () => {
  it('lists the attendees with the meter and the switches labelled "Check in {name}"', async () => {
    const page = await setup();

    expect(page.host.querySelector('h1')!.textContent).toContain(
      'Check-in · Toronto Builders Night',
    );
    expect(page.names()).toEqual(['Ruth Alvarez', 'Abby Brooks']);
    expect(page.host.textContent).toContain('Guest · abby.brooks@example.org · Not here yet');
    expect(page.host.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).toBe(
      '0 of 2 checked in',
    );
    expect(page.toggle('Abby Brooks').checked).toBe(false);
  });

  it('narrows the list by name or email, case-insensitively', async () => {
    const page = await setup();

    await page.search('ABBY');
    expect(page.names()).toEqual(['Abby Brooks']);
    await page.search('brooks@example');
    expect(page.names()).toEqual(['Abby Brooks']);
    await page.search('mira');
    expect(page.names()).toEqual([]);
    expect(page.host.textContent).toContain('Nobody called “mira” has RSVP’d');
  });

  it('checks an attendee in with the server’s time and toasts with Undo', async () => {
    const at = new Date(2026, 10, 6, 18, 41).toISOString();
    const page = await setup(() => of(attendee({ rsvpId: 'r2', checkedInAt: at })));

    page.toggle('Abby Brooks').click();
    await page.settle();

    expect(page.service.checkIn).toHaveBeenCalledWith('e1', 'r2');
    expect(page.host.textContent).toContain('Checked in 6:41 pm');
    const toast = page.toasts.show.mock.calls[0][0];
    expect(toast).toMatchObject({
      variant: 'success',
      heading: 'Abby Brooks is checked in',
      text: '6:41 pm · 1 of 2 here.',
      actionLabel: 'Undo',
    });

    toast.onAction();
    await page.settle();
    expect(page.service.undoCheckIn).toHaveBeenCalledWith('e1', 'r2');
    expect(page.toggle('Abby Brooks').checked).toBe(false);
  });

  it('turns the switch back and toasts danger when the save fails', async () => {
    const page = await setup(() => throwError(() => new Error('offline')));

    page.toggle('Ruth Alvarez').click();
    await page.settle();

    expect(page.toggle('Ruth Alvarez').checked).toBe(false);
    expect(page.host.textContent).toContain('Member · Not here yet');
    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'danger',
        heading: 'Couldn’t save Ruth Alvarez’s check-in. Try again.',
        actionLabel: 'Try again',
      }),
    );
  });
});
