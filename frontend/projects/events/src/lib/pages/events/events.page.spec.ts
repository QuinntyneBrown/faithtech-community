// Traces to: L2-021
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_SERVICE,
  EVENTS_SERVICE,
  EventFilter,
  EventListDto,
  EventSummaryDto,
  ChapterLabel,
  ORGANISATION_SERVICE,
  SITE_SERVICE,
  Capability,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { EventsPage } from './events.page';

function event(overrides: Partial<EventSummaryDto>): EventSummaryDto {
  return {
    id: 'e1',
    title: 'Toronto Builders Night',
    type: 'BuildersNight',
    startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
    endsAt: new Date(2026, 10, 6, 21, 0).toISOString(),
    chapterId: 'c-toronto',
    chapterName: 'Toronto',
    format: 'InPerson',
    venue: 'Kestrel Labs, 220 King St W',
    visibility: 'Public',
    rsvpCount: 34,
    isCancelled: false,
    ...overrides,
  };
}

const builders = event({});
const panel = event({
  id: 'e2',
  title: 'Austin Faith & AI Panel',
  type: 'Panel',
  startsAt: new Date(2026, 9, 30, 19, 0).toISOString(),
  endsAt: new Date(2026, 9, 30, 21, 0).toISOString(),
  chapterId: 'c-austin',
  chapterName: 'Austin',
  format: 'Online',
  venue: null,
  visibility: 'MembersOnly',
  rsvpCount: 0,
  isCancelled: true,
});
const hackathon = event({
  id: 'e3',
  title: 'Hackathon: Tech for Shelters',
  type: 'Hackathon',
  startsAt: new Date(2026, 10, 14, 9, 0).toISOString(),
  endsAt: new Date(2026, 10, 15, 17, 0).toISOString(),
  venue: 'Trinity Community Centre',
  rsvpCount: 52,
});
const all: EventListDto = { events: [panel, builders, hackathon] };
const none: EventListDto = { events: [] };
const CITIES: ChapterLabel = { singular: 'City', plural: 'Cities' };

async function setup(
  list: (filter: EventFilter) => Observable<EventListDto>,
  capabilities: Capability[] = ['ManageEvents'],
  chapterLabel: ChapterLabel | null = CITIES,
) {
  const service = { listEvents: vi.fn(list) };
  const organisation = {
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    chapterLabel,
    chapters: chapterLabel
      ? [
          { id: 'c-toronto', name: 'Toronto' },
          { id: 'c-austin', name: 'Austin' },
        ]
      : [],
    roles: [],
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENTS_SERVICE, useValue: service },
      { provide: AUTH_SERVICE, useValue: { capabilities: signal(capabilities) } },
      { provide: ORGANISATION_SERVICE, useValue: { get: () => of(organisation) } },
      {
        provide: SITE_SERVICE,
        useValue: {
          site: signal({
            name: 'FaithTech Community',
            shortName: 'FaithTech',
            chapterLabel,
            communityOrigin: 'https://app.faithtech.test',
          }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(EventsPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const link = (label: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === label);
  const cards = () => Array.from(host.querySelectorAll('ft-event-card'));
  const select = () => host.querySelector('select') as HTMLSelectElement;
  const choose = async (city: string) => {
    select().value = city;
    select().dispatchEvent(new Event('change'));
    await settle();
  };
  return { fixture, host, service, button, link, cards, select, choose, settle };
}

describe('EventsPage', () => {
  it('lists events with a date badge, a link and a meta line of date, time, city, place and RSVPs', async () => {
    const { host, cards, service } = await setup(() => of(all));

    expect(service.listEvents).toHaveBeenCalledWith({ filter: 'Upcoming', chapterId: null });
    expect(host.querySelector('h1')!.textContent).toContain('Events');
    const [first, second, third] = cards();
    expect(cards()).toHaveLength(3);
    const title = second.querySelector('a')!;
    expect(title.textContent!.trim()).toBe('Toronto Builders Night');
    expect(title.getAttribute('href')).toBe('/events/e1');
    expect(second.querySelector('.ft-event-card__date')!.textContent).toContain('Nov');
    expect(second.querySelector('.ft-event-card__date')!.textContent).toContain('6');
    expect(second.querySelector('.ft-event-card__meta')!.textContent!.trim()).toBe(
      'Fri 6 Nov · 6:30 pm · Toronto · Kestrel Labs, 220 King St W · 34 going',
    );
    expect(second.querySelector('ft-badge')!.textContent!.trim()).toBe('Public');
    expect(third.querySelector('.ft-event-card__meta')!.textContent!.trim()).toBe(
      'Sat 14 – Sun 15 Nov · Toronto · Trinity Community Centre · 52 going',
    );
    expect(first.querySelector('.ft-event-card__meta')!.textContent!.trim()).toBe(
      'Fri 30 Oct · 7:00 pm · Austin · Online · 0 going',
    );
  });

  it('marks a cancelled event with the cancelled badge and muted card (AC4)', async () => {
    const { cards } = await setup(() => of(all));

    const cancelled = cards()[0];
    expect(cancelled.querySelector('ft-badge')!.textContent!.trim()).toBe('Cancelled');
    expect(cancelled.querySelector('.ft-event-card--cancelled')).not.toBeNull();
    expect(cards()[1].querySelector('.ft-event-card--cancelled')).toBeNull();
  });

  it('shows Members only for a members-only event', async () => {
    const { cards } = await setup(() =>
      of({ events: [{ ...builders, visibility: 'MembersOnly' }] }),
    );

    expect(cards()[0].querySelector('ft-badge')!.textContent!.trim()).toBe('Members only');
  });

  // Traces to: L2-021 AC2, L2-142 AC2
  it('applies one chip at a time and the chapter filter (AC2)', async () => {
    const { button, choose, service } = await setup(() => of(all));
    expect(button('Upcoming')!.getAttribute('aria-pressed')).toBe('true');

    button('Hackathons')!.click();
    await new Promise((r) => setTimeout(r));
    expect(service.listEvents).toHaveBeenLastCalledWith({ filter: 'Hackathons', chapterId: null });
    expect(button('Hackathons')!.getAttribute('aria-pressed')).toBe('true');
    expect(button('Upcoming')!.getAttribute('aria-pressed')).toBe('false');

    await choose('c-austin');
    expect(service.listEvents).toHaveBeenLastCalledWith({
      filter: 'Hackathons',
      chapterId: 'c-austin',
    });

    await choose('none');
    expect(service.listEvents).toHaveBeenLastCalledWith({
      filter: 'Hackathons',
      chapterId: 'none',
    });
  });

  // Traces to: L2-142 AC1
  it('offers All cities, the organisation-wide events and the chapters in order', async () => {
    const { select } = await setup(() => of(all));

    expect(Array.from(select().options).map((o) => o.textContent!.trim())).toEqual([
      'All cities',
      'FaithTech-wide',
      'Toronto',
      'Austin',
    ]);
  });

  // Traces to: L2-142 AC3
  it('has no chapter filter while chapters are off', async () => {
    const { select, service, host } = await setup(() => of(all), ['ManageEvents'], null);

    expect(select()).toBeNull();
    expect(service.listEvents).toHaveBeenLastCalledWith({ filter: 'Upcoming', chapterId: null });
    expect(host.textContent).not.toContain('city');
  });

  it('shows the empty state with New event for an event manager when there are no events (AC3)', async () => {
    const { host, link } = await setup(() => of(none));

    expect(host.textContent).toContain('No events yet');
    expect(link('New event')!.getAttribute('href')).toBe('/events/new');
  });

  it('hides New event from members who cannot manage events', async () => {
    const { host, link } = await setup(() => of(none), []);

    expect(host.textContent).toContain('No events yet');
    expect(link('New event')).toBeUndefined();
  });

  it('says no upcoming events in the chosen city and offers to show all cities', async () => {
    let answer = all;
    const { host, button, choose, select } = await setup(() => of(answer));
    answer = { events: [] };

    await choose('c-austin');
    expect(host.textContent).toContain('No upcoming events in Austin');
    expect(host.textContent).toContain('Try another city or include past events.');

    answer = all;
    button('Show all cities')!.click();
    await new Promise((r) => setTimeout(r));
    expect(select().value).toBe('');
  });

  it('shows the error state with Try again, which reloads', async () => {
    let fail = true;
    const { host, button, settle, cards } = await setup(() =>
      fail ? throwError(() => new Error('down')) : of(all),
    );

    expect(host.textContent).toContain('We couldn’t load events');
    fail = false;
    button('Try again')!.click();
    await settle();
    expect(cards()).toHaveLength(3);
  });

  it('shows a labelled date-badge skeleton while loading', async () => {
    const { host } = await setup(() => new Observable<EventListDto>());

    const skeleton = host.querySelector('ft-list-skeleton')!;
    expect(skeleton.getAttribute('aria-label')).toBe('Loading events');
    expect(skeleton.querySelector('.ft-skeleton--date-badge')).not.toBeNull();
  });
});
