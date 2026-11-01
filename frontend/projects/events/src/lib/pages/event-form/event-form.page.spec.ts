// Traces to: L2-020
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import {
  EVENTS_SERVICE,
  EventDetailDto,
  ORGANISATION_SERVICE,
  SITE_SERVICE,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { EventFormPage } from './event-form.page';

const existing: EventDetailDto = {
  id: 'e1',
  title: 'Toronto Builders Night',
  description: 'An evening for Christians who build.',
  type: 'builders-night',
  typeName: 'Builders night',
  startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
  endsAt: new Date(2026, 10, 6, 21, 0).toISOString(),
  chapterId: 'c-toronto',
  chapterName: 'Toronto',
  format: 'InPerson',
  venue: 'Kestrel Labs, 220 King St W',
  onlineLink: null,
  capacity: 60,
  visibility: 'Public',
  rsvpCount: 4,
  isFull: false,
  isCancelled: false,
  cancellationReason: null,
  hubLink: null,
  cancelledByName: null,
  cancelledAt: null,
  hostName: 'Marcus Lee',
  hostRole: 'Event Lead',
  callerHasRsvp: false,
  canManage: true,
  canExportRsvps: true,
  rsvps: [],
  checkedInCount: null,
  canCheckIn: false,
  canViewCheckIn: false,
  hubId: null,
  canManageHub: false,
};

interface Overrides {
  createEvent?: () => Observable<{ id: string }>;
  updateEvent?: () => Observable<void>;
  getEvent?: () => Observable<EventDetailDto>;
}

async function setup(id: string | undefined, overrides: Overrides = {}) {
  const service = {
    createEvent: vi.fn(overrides.createEvent ?? (() => of({ id: 'new-1' }))),
    updateEvent: vi.fn(overrides.updateEvent ?? (() => of(undefined))),
    getEvent: vi.fn(overrides.getEvent ?? (() => of(existing))),
  };
  const organisation = {
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    chapterLabel: { singular: 'City', plural: 'Cities' },
    chapters: [
      { id: 'c-toronto', name: 'Toronto' },
      { id: 'c-austin', name: 'Austin' },
    ],
    roles: [],
    eventTypes: [
      { id: 't-gathering', key: 'gathering', name: 'Gathering' },
      { id: 't-builders', key: 'builders-night', name: 'Builders night' },
      { id: 't-panel', key: 'panel', name: 'Panel' },
    ],
    resourceTypes: [],
    archivedResourceTypes: [],
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENTS_SERVICE, useValue: service },
      { provide: ORGANISATION_SERVICE, useValue: { get: () => of(organisation) } },
      {
        provide: SITE_SERVICE,
        useValue: {
          site: signal({
            name: 'FaithTech Community',
            shortName: 'FaithTech',
            chapterLabel: { singular: 'City', plural: 'Cities' },
            communityOrigin: 'https://app.faithtech.test',
          }),
        },
      },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(EventFormPage);
  if (id) fixture.componentRef.setInput('id', id);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const control = <T extends HTMLElement>(label: string): T => {
    const element = Array.from(host.querySelectorAll('label')).find((l) => {
      const text = l.textContent?.replace('(optional)', '').trim() ?? '';
      // A radio's label also holds its description.
      return text === label || (!!l.querySelector('input[type="radio"]') && text.startsWith(label));
    });
    if (!element) throw new Error(`No field labelled ${label}`);
    const forId = element.getAttribute('for');
    return (forId ? host.querySelector(`#${forId}`) : element.querySelector('input')) as T;
  };
  const type = (label: string, value: string) => {
    const input = control<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(label);
    input.value = value;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
  };
  const choose = (label: string) => control<HTMLInputElement>(label).click();
  const submit = async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };
  const errorFor = (label: string) => {
    const input = control(label);
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    return ids.map((i) => host.querySelector(`#${i}`)?.textContent?.trim() ?? '').join(' ');
  };
  return { fixture, host, service, navigate, control, type, choose, submit, settle, errorFor };
}

async function fillValid(page: Awaited<ReturnType<typeof setup>>) {
  page.type('Title', 'Toronto Builders Night');
  page.type('Type', 'builders-night');
  page.type('Description', 'An evening for Christians who build.');
  page.type('Starts', '2026-11-06T18:30');
  page.type('Ends', '2026-11-06T21:00');
  page.type('City', 'c-toronto');
  page.type('Venue address', 'Kestrel Labs, 220 King St W');
  page.type('Capacity', '60');
  await page.settle();
}

describe('EventFormPage', () => {
  it('creates an event from every field and goes to its page (AC1)', async () => {
    const page = await setup(undefined);
    expect(page.host.querySelector('h1')!.textContent).toContain('New event');
    await fillValid(page);
    page.choose('Members only');

    await page.submit();

    expect(page.service.createEvent).toHaveBeenCalledWith({
      title: 'Toronto Builders Night',
      description: 'An evening for Christians who build.',
      type: 'builders-night',
      startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
      endsAt: new Date(2026, 10, 6, 21, 0).toISOString(),
      chapterId: 'c-toronto',
      format: 'InPerson',
      venue: 'Kestrel Labs, 220 King St W',
      onlineLink: null,
      capacity: 60,
      visibility: 'MembersOnly',
    });
    expect(page.navigate).toHaveBeenCalledWith('/events/new-1');
  });

  // Traces to: L2-145 AC2
  it('offers the organisation’s types in order and starts a new event on the first', async () => {
    const page = await setup(undefined);
    await page.settle();
    const select = page.control<HTMLSelectElement>('Type');

    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual([
      'Gathering',
      'Builders night',
      'Panel',
    ]);
    expect(select.value).toBe('gathering');
  });

  // Traces to: L2-145 AC2, AC4
  it('keeps an event’s archived type, marked archived, until another is chosen', async () => {
    const page = await setup('e1', {
      getEvent: () => of({ ...existing, type: 'workshop', typeName: 'Workshop' }),
    });
    await page.settle();
    const select = page.control<HTMLSelectElement>('Type');

    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual([
      'Gathering',
      'Builders night',
      'Panel',
      'Workshop (archived)',
    ]);
    expect(select.value).toBe('workshop');
    expect(page.host.textContent).toContain(
      'Workshop was archived. It stays on this event until you choose another type.',
    );
    page.type('Type', 'panel');
    await page.settle();
    expect(page.host.textContent).not.toContain('Workshop was archived.');
  });

  // Traces to: L2-141 AC2
  it('offers the organisation-wide option and the chapters, and keeps an archived one the event has', async () => {
    const page = await setup('e1', {
      getEvent: () => of({ ...existing, chapterId: 'c-regina', chapterName: 'Regina' }),
    });
    await page.settle();
    const select = page.control<HTMLSelectElement>('City');

    expect(Array.from(select.options).map((o) => o.textContent!.trim())).toEqual([
      'FaithTech-wide',
      'Toronto',
      'Austin',
      'Regina',
    ]);
    expect(select.value).toBe('c-regina');

    page.type('City', '');
    await page.submit();
    expect(page.service.updateEvent).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ chapterId: null }),
    );
  });

  it('swaps the venue for a joining link when Online is chosen, and leaves capacity optional', async () => {
    const page = await setup(undefined);
    await fillValid(page);
    page.choose('Online');
    await page.settle();
    expect(() => page.control('Venue address')).toThrow();
    page.type('Joining link', 'https://meet.example.org/ft');
    page.type('Capacity', '');

    await page.submit();

    expect(page.service.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'Online',
        venue: null,
        onlineLink: 'https://meet.example.org/ft',
        capacity: null,
      }),
    );
  });

  it('shows inline errors and a summary for a blank title, an end before the start and no venue (AC2)', async () => {
    const page = await setup(undefined);
    await fillValid(page);
    page.type('Title', ' ');
    page.type('Ends', '2026-11-06T17:00');
    page.type('Venue address', '');

    await page.submit();

    expect(page.service.createEvent).not.toHaveBeenCalled();
    expect(page.errorFor('Title')).toContain('Give the event a title people will recognise.');
    expect(page.errorFor('Ends')).toContain('The end time must be after the start time.');
    expect(page.errorFor('Venue address')).toContain('Enter a venue address, or choose Online.');
    const summary = page.host.querySelector('[role="alert"]')!;
    expect(summary.textContent).toContain('Fix 3 things to publish');
    expect(Array.from(summary.querySelectorAll('a')).map((a) => a.textContent!.trim())).toEqual([
      'Enter a title',
      'End must be after start',
      'Enter a venue or choose Online',
    ]);
  });

  it('asks for a joining link for an online event (AC2)', async () => {
    const page = await setup(undefined);
    await fillValid(page);
    page.choose('Online');
    await page.settle();

    await page.submit();

    expect(page.service.createEvent).not.toHaveBeenCalled();
    expect(page.errorFor('Joining link')).toContain('Enter the joining link, or choose In person.');
  });

  it('shows the server’s field errors inline', async () => {
    const page = await setup(undefined, {
      createEvent: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                errors: {
                  Capacity: ['Capacity must be at least 1, or leave it empty for no limit.'],
                },
              },
            }),
        ),
    });
    await fillValid(page);

    await page.submit();

    expect(page.errorFor('Capacity')).toContain('Capacity must be at least 1');
    expect(page.navigate).not.toHaveBeenCalled();
  });

  it('keeps the form and says so when saving fails', async () => {
    const page = await setup(undefined, {
      createEvent: () => throwError(() => new HttpErrorResponse({ status: 0 })),
    });
    await fillValid(page);

    await page.submit();

    expect(page.host.textContent).toContain('We couldn’t publish this event');
    expect(page.control<HTMLInputElement>('Title').value).toBe('Toronto Builders Night');
  });

  it('is busy while publishing', async () => {
    const page = await setup(undefined, { createEvent: () => new Observable<{ id: string }>() });
    await fillValid(page);

    await page.submit();

    const button = page.host.querySelector('button[type="submit"]')!;
    expect(button.getAttribute('aria-busy') ?? button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toContain('Publishing…');
  });

  it('loads the event into the form and saves changes (edit)', async () => {
    const page = await setup('e1');

    expect(page.service.getEvent).toHaveBeenCalledWith('e1');
    expect(page.host.querySelector('h1')!.textContent).toContain('Edit event');
    expect(page.control<HTMLInputElement>('Title').value).toBe('Toronto Builders Night');
    expect(page.control<HTMLInputElement>('Starts').value).toBe('2026-11-06T18:30');
    expect(page.control<HTMLInputElement>('Venue address').value).toBe(
      'Kestrel Labs, 220 King St W',
    );
    expect(page.control<HTMLInputElement>('Public').checked).toBe(true);
    expect(page.host.querySelector('button[type="submit"]')!.textContent).toContain('Save changes');
    page.type('Title', 'Toronto Builders Night (new venue)');

    await page.submit();

    expect(page.service.updateEvent).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ title: 'Toronto Builders Night (new venue)', capacity: 60 }),
    );
    expect(page.navigate).toHaveBeenCalledWith('/events/e1');
  });

  it('shows the error state when the event cannot be loaded, and Try again reloads', async () => {
    let fail = true;
    const page = await setup('e1', {
      getEvent: () => (fail ? throwError(() => new Error('down')) : of(existing)),
    });

    expect(page.host.textContent).toContain('We couldn’t load this event');
    fail = false;
    Array.from(page.host.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Try again'))!
      .click();
    await page.settle();
    expect(page.control<HTMLInputElement>('Title').value).toBe('Toronto Builders Night');
  });
});
