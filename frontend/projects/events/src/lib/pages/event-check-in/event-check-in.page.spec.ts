// Traces to: L2-093, L2-094 (docs/detailed-designs/events/event-check-in)
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CHECK_IN_SERVICE, CheckInAttendeeDto, CheckInDto } from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { AddWalkInDialog } from '../../dialogs';
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

async function setup(
  save: () => Observable<CheckInAttendeeDto> = () => of(attendee({})),
  walkIn: unknown = undefined,
  get: () => Observable<CheckInDto> = () => of(checkIn()),
) {
  const service = {
    getCheckIn: vi.fn(get),
    checkIn: vi.fn(save),
    undoCheckIn: vi.fn(() => of(undefined)),
    exportAttendance: vi.fn(() => of(new Blob(['csv']))),
  };
  const toasts = { show: vi.fn() };
  const dialogs = { open: vi.fn(() => ({ closed: of(walkIn) })) };
  TestBed.configureTestingModule({
    providers: [
      { provide: CHECK_IN_SERVICE, useValue: service },
      { provide: ToastService, useValue: toasts },
      { provide: DialogService, useValue: dialogs },
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
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  return { fixture, host, service, toasts, dialogs, names, toggle, search, settle, button };
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

  it('opens Add walk-in from no results with the term as the name and appends the walk-in', async () => {
    const mira = attendee({
      rsvpId: 'r3',
      profileId: null,
      name: 'Mira',
      isGuest: true,
      isWalkIn: true,
      checkedInAt: new Date(2026, 10, 6, 18, 58).toISOString(),
    });
    const page = await setup(undefined, { attendee: mira, reused: false });

    await page.search('mira');
    page.button('Add “Mira” as a walk-in')!.click();
    await page.settle();

    expect(page.dialogs.open).toHaveBeenCalledWith(AddWalkInDialog, {
      data: { eventId: 'e1', name: 'Mira' },
    });
    expect(page.names()).toEqual(['Ruth Alvarez', 'Abby Brooks', 'Mira']);
    expect(page.host.textContent).toContain('Walk-in · Checked in 6:58 pm');
    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', heading: 'Mira is checked in' }),
    );
  });

  it('updates a reused RSVP in place', async () => {
    const abby = attendee({
      rsvpId: 'r2',
      profileId: null,
      name: 'Abby Brooks',
      isGuest: true,
      email: 'abby.brooks@example.org',
      checkedInAt: new Date(2026, 10, 6, 18, 58).toISOString(),
    });
    const page = await setup(undefined, { attendee: abby, reused: true });

    page.button('Add walk-in')!.click();
    await page.settle();

    expect(page.names()).toEqual(['Ruth Alvarez', 'Abby Brooks']);
    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ heading: 'Abby Brooks already RSVP’d and is checked in' }),
    );
  });

  // L2-092 AC3: members without a lead role get the page's own forbidden state.
  it('shows that check-in is for event leads on 403', async () => {
    const page = await setup(undefined, undefined, () =>
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );

    expect(page.host.querySelector('h1')!.textContent).toContain('Check-in');
    expect(page.host.textContent).toContain('Check-in is for event leads');
  });

  // L2-092 AC2: Staff see the list read-only.
  it('disables every switch and hides Add walk-in for Staff', async () => {
    const page = await setup(undefined, undefined, () =>
      of(checkIn({ canEdit: false, canExport: false })),
    );

    expect(page.host.textContent).toContain('Read-only for Staff');
    expect(page.toggle('Ruth Alvarez').disabled).toBe(true);
    expect(page.button('Add walk-in')).toBeUndefined();
  });

  // L2-094 AC5, AC6: cancelled and not yet open events disable the switches and say why.
  it('says when check-in opens and disables the switches', async () => {
    const page = await setup(undefined, undefined, () => of(checkIn({ isOpen: false })));

    expect(page.host.textContent).toContain(
      'Check-in opens Thu 5 Nov at 6:30 pm, 24 hours before the event.',
    );
    expect(page.toggle('Abby Brooks').disabled).toBe(true);
  });

  it('says a cancelled event takes no check-ins', async () => {
    const page = await setup(undefined, undefined, () =>
      of(checkIn({ isCancelled: true, isOpen: false })),
    );

    expect(page.host.textContent).toContain(
      'This event was cancelled, so no one can be checked in',
    );
    expect(page.host.textContent).not.toContain('Check-in opens');
    expect(page.button('Add walk-in')).toBeUndefined();
  });

  // L2-094 AC7: everyone checked in shows Everyone's here.
  it('shows Everyone’s here once every attendee is checked in', async () => {
    const at = new Date(2026, 10, 6, 18, 41).toISOString();
    const page = await setup(undefined, undefined, () =>
      of(
        checkIn({
          attendees: [
            attendee({ checkedInAt: at }),
            attendee({ rsvpId: 'r2', name: 'Mira', isWalkIn: true, checkedInAt: at }),
          ],
        }),
      ),
    );

    expect(page.host.textContent).toContain('Everyone’s here');
    expect(page.host.textContent).toContain('All 1 who RSVP’d are checked in, plus 1 walk-in.');
  });

  it('says the event can’t be found on 404', async () => {
    const page = await setup(undefined, undefined, () =>
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );

    expect(page.host.textContent).toContain('We couldn’t find that event');
  });

  // L2-097 AC1, AC4: Export CSV downloads the attendance; a failure offers Try again.
  it('exports the attendance and toasts the file name', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:csv');
    URL.revokeObjectURL = vi.fn();
    const page = await setup();

    page.button('Export CSV')!.click();
    await page.settle();

    expect(page.service.exportAttendance).toHaveBeenCalledWith('e1');
    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'success',
        heading: 'Attendance exported',
        text: 'toronto-builders-night-attendance.csv is in your downloads.',
      }),
    );
  });

  it('offers Try again when the export fails', async () => {
    const page = await setup();
    page.service.exportAttendance.mockImplementation(() => throwError(() => new Error('offline')));

    page.button('Export CSV')!.click();
    await page.settle();

    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'danger',
        heading: 'We couldn’t export the attendance',
        actionLabel: 'Try again',
      }),
    );
  });
});
