// Traces to: L2-022, L2-020 AC5
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENTS_SERVICE, EventDetailDto } from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { CancelEventDialog, CancelRsvpDialog } from '../../dialogs';
import { EventPage } from './event.page';

function detail(overrides: Partial<EventDetailDto> = {}): EventDetailDto {
  return {
    id: 'e1',
    title: 'Toronto Builders Night',
    description: 'An evening for Christians who build.',
    type: 'BuildersNight',
    startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
    endsAt: new Date(2026, 10, 6, 21, 0).toISOString(),
    city: 'Toronto',
    format: 'InPerson',
    venue: 'Kestrel Labs, 220 King St W',
    onlineLink: null,
    capacity: null,
    visibility: 'Public',
    rsvpCount: 34,
    isFull: false,
    isCancelled: false,
    cancellationReason: null,
    cancelledByName: null,
    cancelledAt: null,
    hostName: 'Marcus Lee',
    hostRole: 'Event Lead',
    callerHasRsvp: false,
    canManage: false,
    canExportRsvps: false,
    rsvps: null,
    checkedInCount: null,
    canCheckIn: false,
    canViewCheckIn: false,
    ...overrides,
  };
}

const lead = detail({
  canManage: true,
  canExportRsvps: true,
  rsvps: [
    {
      profileId: 'p2',
      name: 'Jonah Bell',
      isGuest: false,
      guestEmail: null,
      rsvpedAt: new Date(2026, 9, 20, 9).toISOString(),
      checkedInAt: null,
    },
    {
      profileId: null,
      name: 'Abby Brooks',
      isGuest: true,
      guestEmail: 'abby.brooks@example.org',
      rsvpedAt: new Date(2026, 9, 17, 9).toISOString(),
      checkedInAt: null,
    },
  ],
});

interface Overrides {
  getEvent?: () => Observable<EventDetailDto>;
  rsvp?: () => Observable<void>;
  exportRsvps?: () => Observable<Blob>;
  dialogResult?: boolean;
}

async function setup(overrides: Overrides = {}) {
  let current = detail();
  const service = {
    getEvent: vi.fn(overrides.getEvent ?? (() => of(current))),
    rsvp: vi.fn(overrides.rsvp ?? (() => of(undefined))),
    exportRsvps: vi.fn(overrides.exportRsvps ?? (() => of(new Blob(['csv'])))),
    downloadCalendar: vi.fn(() => of(new Blob(['BEGIN:VCALENDAR']))),
  };
  const dialogs = {
    open: vi.fn(() => ({ closed: of(overrides.dialogResult ?? true) })),
  };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENTS_SERVICE, useValue: service },
      { provide: DialogService, useValue: dialogs },
      { provide: ToastService, useValue: toasts },
    ],
  });
  const fixture = TestBed.createComponent(EventPage);
  fixture.componentRef.setInput('id', 'e1');
  // Actions chain several awaits (request, then reload), so let each finish.
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
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const link = (label: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === label);
  const fact = (term: string) =>
    Array.from(host.querySelectorAll('dt'))
      .find((dt) => dt.textContent?.trim() === term)
      ?.nextElementSibling?.textContent?.trim();
  const show = async (next: EventDetailDto) => {
    current = next;
    service.getEvent.mockImplementation(() => of(current));
    fixture.componentRef.setInput('id', 'other');
    await settle();
    fixture.componentRef.setInput('id', 'e1');
    await settle();
  };
  return { fixture, host, service, dialogs, toasts, button, link, fact, settle, show };
}

describe('EventPage', () => {
  it('shows the event’s title, date, about text and facts', async () => {
    const page = await setup();

    expect(page.service.getEvent).toHaveBeenCalledWith('e1');
    expect(page.host.querySelector('h1')!.textContent).toContain('Toronto Builders Night');
    expect(page.host.textContent).toContain('Fri 6 Nov 2026 · 6:30 – 9:00 pm');
    expect(page.host.textContent).toContain('An evening for Christians who build.');
    expect(page.fact('Where')).toBe('Kestrel Labs, 220 King St W, Toronto');
    expect(page.fact('Format')).toBe('In person');
    expect(page.fact('Hosted by')).toBe('Marcus Lee, Event Lead');
    expect(page.fact('Visibility')).toBe('Public · anyone can register');
    expect(page.fact('Going')).toBe('34 people');
  });

  it('shows an attendee only the RSVP count, not the list (AC3)', async () => {
    const page = await setup();

    expect(page.host.textContent).not.toContain('Going (34)');
    expect(page.button('Export CSV')).toBeUndefined();
    expect(page.link('Edit')).toBeUndefined();
  });

  it('RSVPs and shows You’re going with Cancel my RSVP (AC1)', async () => {
    const page = await setup();

    page.service.getEvent.mockImplementation(() =>
      of(detail({ callerHasRsvp: true, rsvpCount: 35 })),
    );
    page.button('RSVP')!.click();
    await page.settle();

    expect(page.service.rsvp).toHaveBeenCalledWith('e1');
    expect(page.host.textContent).toContain('You’re going');
    expect(page.host.textContent).toContain(
      'We’ve emailed you a confirmation with a calendar invite.',
    );
    expect(page.button('RSVP')).toBeUndefined();
    expect(page.button('Cancel my RSVP')).toBeTruthy();
    expect(page.fact('Going')).toBe('35 people');
  });

  it('says why an RSVP was refused, such as a full event (L2-020 AC5)', async () => {
    const page = await setup({
      rsvp: () =>
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { detail: 'This event is full.' } }),
        ),
    });

    page.button('RSVP')!.click();
    await page.settle();

    expect(page.host.querySelector('[role="alert"]')!.textContent).toContain('This event is full.');
  });

  it('shows a full event as full instead of offering RSVP', async () => {
    const page = await setup();
    await page.show(detail({ isFull: true, capacity: 34 }));

    expect(page.button('RSVP')).toBeUndefined();
    expect(page.host.textContent).toContain('This event is full');
  });

  it('cancels the RSVP through the dialog and can RSVP again (AC2)', async () => {
    const page = await setup();
    await page.show(detail({ callerHasRsvp: true }));

    page.service.getEvent.mockImplementation(() =>
      of(detail({ callerHasRsvp: false, rsvpCount: 33 })),
    );
    page.button('Cancel my RSVP')!.click();
    await page.settle();

    expect(page.dialogs.open).toHaveBeenCalledWith(
      CancelRsvpDialog,
      expect.objectContaining({ data: { eventId: 'e1', hostName: 'Marcus Lee' } }),
    );
    expect(page.button('RSVP')).toBeTruthy();
    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ heading: 'Your RSVP is cancelled' }),
    );
  });

  it('shows a lead the RSVP list with guest emails, Export CSV and Edit (AC4, AC5)', async () => {
    const page = await setup();
    await page.show(lead);

    expect(page.host.textContent).toContain('Going (34)');
    const items = Array.from(page.host.querySelectorAll('ft-list-item'));
    expect(items.map((i) => i.querySelector('.ft-list-item__title')!.textContent!.trim())).toEqual([
      'Jonah Bell',
      'Abby Brooks',
    ]);
    expect(items[0].textContent).toContain('Member · RSVP’d Tue 20 Oct');
    expect(items[1].textContent).toContain('Guest · abby.brooks@example.org · RSVP’d Sat 17 Oct');
    expect(items[1].querySelector('ft-badge')!.textContent!.trim()).toBe('Guest');
    expect(page.link('Edit')!.getAttribute('href')).toBe('/events/e1/edit');
    expect(page.host.textContent).toContain(
      'Only leads and Staff see this list. Attendees see the count.',
    );
  });

  it('shows Staff the list without Export CSV', async () => {
    const page = await setup();
    await page.show({ ...lead, canManage: false, canExportRsvps: false });

    expect(page.host.textContent).toContain('Going (34)');
    expect(page.button('Export CSV')).toBeUndefined();
  });

  it('downloads the RSVP list as CSV (AC5)', async () => {
    const page = await setup();
    await page.show(lead);
    const createUrl = vi.fn(() => 'blob:rsvps');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    page.button('Export CSV')!.click();
    await page.settle();

    expect(page.service.exportRsvps).toHaveBeenCalledWith('e1');
    expect(click).toHaveBeenCalled();
    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ heading: 'RSVP list exported' }),
    );
    click.mockRestore();
  });

  it('shows a cancelled event as cancelled with who, when and why, and no RSVP', async () => {
    const page = await setup();
    await page.show(
      detail({
        isCancelled: true,
        cancellationReason: 'Our venue fell through.',
        cancelledByName: 'Esther Nakamura',
        cancelledAt: new Date(2026, 9, 20, 9).toISOString(),
        canManage: true,
      }),
    );

    expect(page.host.textContent).toContain('This event was cancelled');
    expect(page.host.textContent).toContain(
      'Esther Nakamura cancelled it on Tue 20 Oct: “Our venue fell through.” Everyone who RSVP’d was emailed.',
    );
    expect(page.button('Cancel event')).toBeUndefined();
    expect(page.link('Edit')).toBeUndefined();
    expect(page.button('RSVP')).toBeUndefined();
    expect(page.button('Update your calendar (.ics)')).toBeTruthy();
  });

  it('shows the error state with Try again', async () => {
    let fail = true;
    const page = await setup({
      getEvent: () => (fail ? throwError(() => new Error('down')) : of(detail())),
    });

    expect(page.host.textContent).toContain('We couldn’t load this event');
    fail = false;
    page.button('Try again')!.click();
    await page.settle();
    expect(page.host.querySelector('h1')!.textContent).toContain('Toronto Builders Night');
  });

  it('gives event managers the public page link to copy and preview (L2-023 AC1)', async () => {
    const page = await setup();
    await page.show(lead);
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const link = page.host.querySelector('input[readonly]') as HTMLInputElement;
    expect(link.value).toBe(`${location.origin}/public/events/e1`);
    expect(page.link('Preview public page')!.getAttribute('href')).toBe('/public/events/e1');
    (page.host.querySelector('button[aria-label="Copy link"]') as HTMLButtonElement).click();
    await page.settle();

    expect(writeText).toHaveBeenCalledWith(`${location.origin}/public/events/e1`);
    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({
        heading: 'Link copied',
        text: 'Anyone with the link can see Toronto Builders Night and RSVP.',
      }),
    );
  });

  it('has no public page card for a members-only event or for attendees', async () => {
    const page = await setup();
    expect(page.host.textContent).not.toContain('Public page');

    await page.show({ ...lead, visibility: 'MembersOnly' });
    expect(page.host.textContent).not.toContain('Public page');
  });

  it('downloads the event’s .ics with the member’s sign-in (L2-024)', async () => {
    const page = await setup();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:ics'), revokeObjectURL: vi.fn() });
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    page.button('Add to calendar (.ics)')!.click();
    await page.settle();

    expect(page.service.downloadCalendar).toHaveBeenCalledWith('e1');
    expect(names).toEqual(['toronto-builders-night.ics']);
    click.mockRestore();
  });

  it('lets an event manager cancel the event through the dialog (L2-025 AC1)', async () => {
    const page = await setup();
    await page.show(lead);

    page.service.getEvent.mockImplementation(() =>
      of({ ...lead, isCancelled: true, cancellationReason: 'Our venue fell through.' }),
    );
    page.button('Cancel event')!.click();
    await page.settle();

    expect(page.dialogs.open).toHaveBeenCalledWith(
      CancelEventDialog,
      expect.objectContaining({
        data: { eventId: 'e1', title: 'Toronto Builders Night', rsvpCount: 34, memberCount: 1 },
      }),
    );
    expect(page.toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ heading: 'Event cancelled' }),
    );
    expect(page.host.textContent).toContain('This event was cancelled');
  });

  it('offers no Cancel event to members who cannot manage events', async () => {
    const page = await setup();

    expect(page.button('Cancel event')).toBeUndefined();
  });

  // L2-121 AC1, L2-117 AC1: leads see the check-in count beside the RSVP count and are offered Check in.
  it('shows leads the check-in count and Check in', async () => {
    const page = await setup();
    await page.show({
      ...lead,
      checkedInCount: 1,
      canCheckIn: true,
      canViewCheckIn: true,
      rsvps: lead.rsvps!.map((r, i) =>
        i === 0 ? { ...r, checkedInAt: new Date(2026, 10, 6, 18, 41).toISOString() } : r,
      ),
    });

    expect(page.fact('Going')).toBe('34 people · 1 checked in');
    expect(page.host.textContent).toContain('Going (34) · 1 checked in');
    expect(page.host.textContent).toContain('Member · Checked in 6:41 pm');
    expect(page.link('Check in')!.getAttribute('href')).toBe('/events/e1/check-in');
    expect(page.link('View check-in')).toBeUndefined();
  });

  // L2-121 AC2: no count before anyone checks in; Staff get View check-in.
  it('offers Staff View check-in and shows no count before anyone checks in', async () => {
    const page = await setup();
    await page.show({ ...lead, checkedInCount: 0, canViewCheckIn: true });

    expect(page.fact('Going')).toBe('34 people');
    expect(page.link('View check-in')!.getAttribute('href')).toBe('/events/e1/check-in');
    expect(page.link('Check in')).toBeUndefined();
  });
});
