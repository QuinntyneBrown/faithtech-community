// Traces to: L2-023
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EVENTS_SERVICE, PublicEventDto, SITE_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { PublicEventPage } from './public-event.page';

/** The host's organisation the copy names, as GET /api/site answers it on FaithTech's host. */
const FAITHTECH_SITE = {
  site: () => ({
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    chapterLabel: { singular: 'City', plural: 'Cities' },
    communityOrigin: 'http://localhost:4200',
  }),
  load: async () => undefined,
};

function publicEvent(overrides: Partial<PublicEventDto> = {}): PublicEventDto {
  return {
    id: 'e1',
    title: 'Toronto Builders Night',
    description: 'An evening for Christians who build.',
    type: 'BuildersNight',
    startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
    endsAt: new Date(2026, 10, 6, 21, 0).toISOString(),
    chapterName: 'Toronto',
    format: 'InPerson',
    venue: 'Kestrel Labs, 220 King St W',
    rsvpCount: 34,
    isFull: false,
    isCancelled: false,
    cancellationReason: null,
    ...overrides,
  };
}

interface Overrides {
  getPublicEvent?: () => Observable<PublicEventDto>;
  rsvpAsGuest?: () => Observable<void>;
}

async function setup(overrides: Overrides = {}) {
  const service = {
    getPublicEvent: vi.fn(overrides.getPublicEvent ?? (() => of(publicEvent()))),
    rsvpAsGuest: vi.fn(overrides.rsvpAsGuest ?? (() => of(undefined))),
    calendarUrl: vi.fn(
      (id: string, options?: { isPublic?: boolean }) =>
        `/api/${options?.isPublic ? 'public/' : ''}events/${id}/calendar.ics`,
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SITE_SERVICE, useValue: FAITHTECH_SITE },
      { provide: EVENTS_SERVICE, useValue: service },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PublicEventPage);
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
  const input = (label: string) => {
    const element = Array.from(host.querySelectorAll('label')).find(
      (l) => l.textContent?.trim() === label,
    )!;
    return host.querySelector(`#${element.getAttribute('for')}`) as HTMLInputElement;
  };
  const type = (label: string, value: string) => {
    input(label).value = value;
    input(label).dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };
  const errorFor = (label: string) =>
    (input(label).getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => (id ? (host.querySelector(`#${id}`)?.textContent?.trim() ?? '') : ''))
      .join(' ');
  return { fixture, host, service, navigate, input, type, submit, settle, errorFor };
}

describe('PublicEventPage', () => {
  it('shows a public event to anyone, with the guest RSVP form (AC1)', async () => {
    const page = await setup();

    expect(page.service.getPublicEvent).toHaveBeenCalledWith('e1');
    expect(page.host.textContent).toContain('FaithTech Toronto · Public event');
    expect(page.host.querySelector('h1')!.textContent).toContain('Toronto Builders Night');
    expect(page.host.textContent).toContain(
      'Fri 6 Nov 2026 · 6:30 – 9:00 pm · Kestrel Labs, 220 King St W',
    );
    expect(page.host.textContent).toContain('An evening for Christians who build.');
    expect(page.host.textContent).toContain('No account needed. 34 people are going.');
    expect(page.input('Your name')).toBeTruthy();
    expect(page.input('Email')).toBeTruthy();
    expect(page.host.querySelector('a[href="/sign-in?returnUrl=%2Fevents%2Fe1"]')).not.toBeNull();
  });

  it('sends a members-only or unknown event’s visitor to sign in (AC3)', async () => {
    const page = await setup({
      getPublicEvent: () => throwError(() => new HttpErrorResponse({ status: 404 })),
    });

    expect(page.navigate).toHaveBeenCalledWith('/sign-in?returnUrl=%2Fevents%2Fe1');
  });

  it('RSVPs a guest with a name and email and says they are on the list (AC2)', async () => {
    const page = await setup();
    page.type('Your name', ' Abby Brooks ');
    page.type('Email', 'abby.brooks@example.org');

    await page.submit();

    expect(page.service.rsvpAsGuest).toHaveBeenCalledWith('e1', {
      name: 'Abby Brooks',
      email: 'abby.brooks@example.org',
    });
    expect(page.host.textContent).toContain('You’re on the list, Abby');
    expect(page.host.textContent).toContain('We sent a confirmation to abby.brooks@example.org.');
    expect(page.host.querySelector('a[href="/sign-up"]')!.textContent).toContain(
      'Create a FaithTech account',
    );
  });

  it('asks for a name and a valid email before sending', async () => {
    const page = await setup();
    page.type('Email', 'abby.brooks@');

    await page.submit();

    expect(page.service.rsvpAsGuest).not.toHaveBeenCalled();
    expect(page.errorFor('Your name')).toContain('Enter your name so the host knows who’s coming.');
    expect(page.errorFor('Email')).toContain('Enter an email like name@example.org.');
    expect(page.host.textContent).toContain('Fix 2 things to RSVP');
  });

  it('keeps the details and says so when the RSVP cannot be saved', async () => {
    const page = await setup({
      rsvpAsGuest: () => throwError(() => new HttpErrorResponse({ status: 0 })),
    });
    page.type('Your name', 'Abby Brooks');
    page.type('Email', 'abby.brooks@example.org');

    await page.submit();

    expect(page.host.textContent).toContain('We couldn’t save your RSVP');
    expect(page.input('Your name').value).toBe('Abby Brooks');
  });

  it('says when too many RSVPs came from this connection (AC4)', async () => {
    const page = await setup({
      rsvpAsGuest: () => throwError(() => new HttpErrorResponse({ status: 429 })),
    });
    page.type('Your name', 'Abby Brooks');
    page.type('Email', 'abby.brooks@example.org');

    await page.submit();

    expect(page.host.textContent).toContain('Too many RSVPs from this connection');
  });

  it('shows the server’s reason when the event refuses the RSVP', async () => {
    const page = await setup({
      rsvpAsGuest: () =>
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { detail: 'This event is full.' } }),
        ),
    });
    page.type('Your name', 'Abby Brooks');
    page.type('Email', 'abby.brooks@example.org');

    await page.submit();

    expect(page.host.textContent).toContain('This event is full.');
  });

  it('shows a full event without the form', async () => {
    const page = await setup({ getPublicEvent: () => of(publicEvent({ isFull: true })) });

    expect(page.host.textContent).toContain('This event is full');
    expect(page.host.querySelector('form')).toBeNull();
  });

  it('shows a cancelled event with its reason and no form', async () => {
    const page = await setup({
      getPublicEvent: () =>
        of(publicEvent({ isCancelled: true, cancellationReason: 'Our venue fell through.' })),
    });

    expect(page.host.textContent).toContain('This event was cancelled');
    expect(page.host.textContent).toContain('Our venue fell through.');
    expect(page.host.textContent).toContain('Was Fri 6 Nov · Toronto');
    expect(page.host.querySelector('form')).toBeNull();
  });

  it('shows the error state with Try again when the event cannot load', async () => {
    let fail = true;
    const page = await setup({
      getPublicEvent: () =>
        fail ? throwError(() => new HttpErrorResponse({ status: 503 })) : of(publicEvent()),
    });

    expect(page.host.textContent).toContain('We couldn’t load this event');
    fail = false;
    Array.from(page.host.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Try again'))!
      .click();
    await page.settle();
    expect(page.host.querySelector('h1')!.textContent).toContain('Toronto Builders Night');
  });

  it('offers the public .ics download before and after the RSVP (L2-024)', async () => {
    const page = await setup();
    const links = () =>
      Array.from(page.host.querySelectorAll('a')).filter(
        (a) => a.textContent?.trim() === 'Add to calendar (.ics)',
      );
    expect(links().map((a) => a.getAttribute('href'))).toEqual([
      '/api/public/events/e1/calendar.ics',
    ]);

    page.type('Your name', 'Abby Brooks');
    page.type('Email', 'abby.brooks@example.org');
    await page.submit();

    expect(links()).toHaveLength(2);
  });

  it('offers a cancelled event’s .ics so calendars can update (L2-024 AC2)', async () => {
    const page = await setup({ getPublicEvent: () => of(publicEvent({ isCancelled: true })) });

    const link = Array.from(page.host.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Update your calendar (.ics)',
    )!;
    expect(link.getAttribute('href')).toBe('/api/public/events/e1/calendar.ics');
    expect(page.host.textContent).not.toContain('Add to calendar');
  });
});
