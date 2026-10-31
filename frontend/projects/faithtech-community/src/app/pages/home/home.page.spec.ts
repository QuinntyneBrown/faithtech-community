// Traces to: L2-049
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ACTIVITY_SERVICE,
  AUTH_SERVICE,
  EVENTS_SERVICE,
  EventSummaryDto,
  ORGANISATION_SERVICE,
  PARTNERS_SERVICE,
  PartnerBoardDto,
  Capability,
} from '@faithtech-community/api';
import { NEVER, Observable, of, throwError } from 'rxjs';

import { HomePage } from './home.page';

function event(id: string, overrides: Partial<EventSummaryDto> = {}): EventSummaryDto {
  return {
    id,
    title: `Event ${id}`,
    type: 'gathering',
    typeName: 'Gathering',
    startsAt: new Date(2026, 10, 6, 18, 30).toISOString(),
    endsAt: new Date(2026, 10, 6, 21, 0).toISOString(),
    chapterId: 'c-toronto',
    chapterName: 'Toronto',
    format: 'InPerson',
    venue: 'Kestrel Labs',
    visibility: 'Public',
    rsvpCount: 0,
    isCancelled: false,
    ...overrides,
  };
}

const board: PartnerBoardDto = {
  canEdit: true,
  columns: [
    {
      stage: 'lead',
      stageId: 's1',
      name: 'Lead',
      kind: 'Open',
      archived: false,
      count: 4,
      cards: [],
    },
    {
      stage: 'in-funnel',
      stageId: 's2',
      name: 'In Funnel',
      kind: 'Open',
      archived: false,
      count: 3,
      cards: [],
    },
    {
      stage: 'confirmed',
      stageId: 's3',
      name: 'Confirmed',
      kind: 'Confirmed',
      archived: false,
      count: 5,
      cards: [],
    },
  ],
};

// L2-135 AC7: home decides from capabilities; the oversight banner from the held roles' flag.
async function setup(
  capabilities: Capability[],
  events = [event('a'), event('b')],
  roles: { name: string; isOversight: boolean }[] = capabilities.length
    ? [{ name: 'A role', isOversight: false }]
    : [],
  getBoard: () => Observable<PartnerBoardDto> = () => of(board),
) {
  const services = {
    events: { listEvents: vi.fn(() => of({ events, cities: [] })) },
    partners: { getBoard: vi.fn(getBoard) },
    activity: { recent: vi.fn(() => of([])) },
  };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AUTH_SERVICE,
        useValue: {
          capabilities: signal(capabilities),
          currentUser: signal({ name: 'Grace Okonkwo', roles, capabilities, profileId: 'p1' }),
        },
      },
      { provide: EVENTS_SERVICE, useValue: services.events },
      { provide: PARTNERS_SERVICE, useValue: services.partners },
      { provide: ACTIVITY_SERVICE, useValue: services.activity },
      {
        provide: ORGANISATION_SERVICE,
        useValue: {
          get: () =>
            of({
              partnerStages: board.columns.map((c) => ({
                id: c.stageId,
                key: c.stage,
                name: c.name,
                isInitial: c.stage === 'lead',
                kind: c.kind,
              })),
            }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, services };
}

const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';

describe('HomePage', () => {
  it('shows a lead the quick actions and the pipeline counts', async () => {
    const { el } = await setup(['ManageEvents', 'KeepContacts', 'ViewPartners', 'ManagePartners']);

    expect(text(el)).toContain('New event');
    expect(text(el)).toContain('Add contact');
    expect(text(el)).toContain('Partner pipeline');
    expect(
      [...el.querySelectorAll('ft-stat')].map((s) => [
        s.querySelector('.ft-stat__label')?.textContent,
        s.querySelector('.ft-stat__value')?.textContent?.trim(),
      ]),
    ).toEqual([
      ['Lead', '4'],
      ['In Funnel', '3'],
      ['Confirmed', '5'],
    ]);
  });

  it('names the organisation stages in the pipeline skeleton while the board loads', async () => {
    const { el } = await setup(['ViewPartners'], undefined, undefined, () => NEVER);

    expect(
      [...el.querySelectorAll('ft-stat')].map(
        (s) => s.querySelector('.ft-stat__label')?.textContent,
      ),
    ).toEqual(['Lead', 'In Funnel', 'Confirmed']);
    expect(
      el.querySelector('ft-stat [aria-busy="true"], ft-stat[aria-busy="true"]'),
    ).not.toBeNull();
  });

  it('greets a member with no role and never asks for events or partners', async () => {
    const { el, services } = await setup([]);

    expect(el.querySelector('h1')?.textContent).toBe('Welcome, Grace');
    expect(text(el)).toContain('Finish your profile');
    expect(services.events.listEvents).not.toHaveBeenCalled();
    expect(services.partners.getBoard).not.toHaveBeenCalled();
    expect(services.activity.recent).toHaveBeenCalled();
  });

  it('shows an oversight role the banner and no write actions', async () => {
    const { el } = await setup(['ViewPartners', 'ViewReports'], undefined, [
      { name: 'Staff', isOversight: true },
    ]);

    expect(text(el)).toContain('You’re viewing as Staff');
    expect(text(el)).not.toContain('New event');
    expect(text(el)).not.toContain('Add contact');
    expect(text(el)).toContain('Partner pipeline');
  });

  it('leaves cancelled events out of Coming up and counts the rest', async () => {
    const { el } = await setup(
      ['JoinWorkspaces'],
      [event('a'), event('b', { isCancelled: true }), event('c'), event('d'), event('e')],
    );

    expect(el.querySelectorAll('ft-event-card')).toHaveLength(3);
    expect(text(el)).toContain('4 events coming up');
    expect(text(el)).not.toContain('Partner pipeline');
  });

  it('replaces the page with the error state when events fail', async () => {
    TestBed.overrideProvider(EVENTS_SERVICE, {
      useValue: { listEvents: () => throwError(() => new Error('offline')) },
    });
    const { el } = await setup(['ManageEvents', 'ViewPartners']);

    expect(text(el)).toContain('We couldn’t load your home page');
    expect(el.querySelector('ft-event-card')).toBeNull();
  });
});
