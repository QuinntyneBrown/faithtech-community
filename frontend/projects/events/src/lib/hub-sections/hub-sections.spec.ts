// Traces to: L2-157 AC2 to AC4; L2-158 AC2, AC3 (docs/detailed-designs/events/fill-in-hub-sections)
import { HttpErrorResponse } from '@angular/common/http';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EventHubDto, EventHubsService } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubGivingComponent } from './hub-giving.component';
import { HubHeroComponent } from './hub-hero.component';
import { SectionSaver } from './section-saver';

function hubFixture(overrides: Partial<EventHubDto> = {}): EventHubDto {
  return {
    id: 'h1',
    eventId: 'e1',
    status: 'Draft',
    templateKey: 'blank',
    link: 'https://app.faithtech.community/public/events/e1/hub',
    event: {
      title: 'Toronto Builders Night',
      startsAt: '2026-11-06T23:30:00.000Z',
      endsAt: '2026-11-07T02:00:00.000Z',
      format: 'InPerson',
      venue: 'Kestrel Labs, 220 King St W, Toronto',
      onlineLink: null,
      rsvpLink: 'https://app.faithtech.community/public/events/e1',
      isCancelled: false,
    },
    sections: [
      { kind: 'Hero', visible: true, state: 'Ready', content: { subtitle: 'A night of building' } },
      {
        kind: 'Giving',
        visible: true,
        state: 'Ready',
        content: { line: 'Tonight’s gifts fund the build.' },
      },
    ],
    organisation: {
      name: 'FaithTech Community',
      shortName: 'FaithTech',
      givingLink: 'https://faithtech.com/donate',
      givingText: 'Help us build the next one.',
    },
    upcomingEvents: [],
    ...overrides,
  };
}

function render<T>(component: Type<T>, hub: EventHubDto): HTMLElement {
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput('hub', hub);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SectionSaver', () => {
  const saving = (result: Observable<void>) => {
    const hubs = { saveSection: vi.fn(() => result) } as unknown as EventHubsService;
    return { hubs, saver: new SectionSaver(hubs, 'e1', 'Agenda') };
  };

  it('saves the content of its section', async () => {
    const { hubs, saver } = saving(of(undefined));

    expect(await saver.save({ items: [] })).toBe(true);
    expect(hubs.saveSection).toHaveBeenCalledWith('e1', 'Agenda', { items: [] });
  });

  it('gives each field its message from a 400, by path', async () => {
    const { saver } = saving(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { 'Items[2].Title': ['Say what’s happening.'] } },
          }),
      ),
    );

    expect(await saver.save({ items: [] })).toBe(false);
    expect(saver.error('items[2].title')).toBe('Say what’s happening.');
    expect(saver.failed()).toBe(false);
  });

  it('says it failed for anything else', async () => {
    const { saver } = saving(throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(await saver.save({ items: [] })).toBe(false);
    expect(saver.failed()).toBe(true);
  });
});

describe('Hub section displays', () => {
  it('shows the Hero from the event, the organisation and the subtitle', () => {
    const host = render(HubHeroComponent, hubFixture());

    expect(host.querySelector('h3')?.textContent).toBe('Toronto Builders Night');
    expect(host.textContent).toContain('FaithTech Community');
    expect(host.textContent).toContain('A night of building');
    expect(host.textContent).toContain('Kestrel Labs, 220 King St W, Toronto');
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      'https://app.faithtech.community/public/events/e1',
    );
  });

  it('shows Online for an online event', () => {
    const hub = hubFixture();
    const host = render(HubHeroComponent, {
      ...hub,
      event: { ...hub.event, format: 'Online', venue: null },
    });

    expect(host.textContent).toContain('· Online');
  });

  it('shows Giving with the event line and the organisation’s link', () => {
    const host = render(HubGivingComponent, hubFixture());

    expect(host.textContent).toContain('Tonight’s gifts fund the build.');
    expect(host.textContent).toContain('Help us build the next one.');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('https://faithtech.com/donate');
  });

  it('shows no Give link without the organisation’s giving link', () => {
    const hub = hubFixture();
    const host = render(HubGivingComponent, {
      ...hub,
      organisation: { ...hub.organisation, givingLink: null, givingText: null },
    });

    expect(host.querySelector('a')).toBeNull();
  });
});
