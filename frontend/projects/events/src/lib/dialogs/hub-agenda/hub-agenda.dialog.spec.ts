// Traces to: L2-157 AC2; L2-159 AC1 to AC3, AC7 (docs/detailed-designs/events/fill-in-hub-sections)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { Observable, of } from 'rxjs';

import { HubAgendaDialog } from './hub-agenda.dialog';

function hubFixture(overrides: Partial<EventHubDto> = {}): EventHubDto {
  return {
    id: 'h1',
    eventId: 'e1',
    status: 'Draft',
    publishedAt: null,
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

const local = (h: number, m = 0) => new Date(2026, 10, 6, h, m).toISOString();

function setup() {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn<() => Observable<void>>(() => of(undefined));
  const base = hubFixture();
  const hub: EventHubDto = {
    ...base,
    event: { ...base.event, startsAt: local(18, 30), endsAt: local(21) },
    sections: [{ kind: 'Agenda', visible: true, state: 'NeedsInfo', content: { items: [] } }],
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub } },
    ],
  });
  const fixture = TestBed.createComponent(HubAgendaDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  const click = async (name: string) => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === name)!
      .click();
    await settle();
  };
  const fill = (index: number, value: string) => {
    const input = host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      '.agenda-entry input, .agenda-entry textarea',
    )[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const titles = () =>
    Array.from(host.querySelectorAll('.ft-reorderable-list__title')).map((t) => t.textContent);
  return { host, ref, saveSection, click, fill, titles };
}

describe('HubAgendaDialog', () => {
  it('asks for a time and a title, then adds rows in time order', async () => {
    const { host, click, fill, titles } = setup();
    expect(host.textContent).toContain('No rows yet. Add the first one, or paste a schedule.');

    await click('Add row');
    expect(host.textContent).toContain('Enter a time.');
    expect(host.textContent).toContain('Say what’s happening.');

    fill(0, '19:00');
    fill(1, 'Build time');
    await click('Add row');
    fill(0, '18:30');
    fill(1, 'Doors open');
    await click('Add row');

    expect(titles()).toEqual(['Doors open', 'Build time']);
  });

  it('adds the rows of a pasted schedule only once confirmed', async () => {
    const { host, click, fill, titles } = setup();

    await click('Paste a schedule');
    fill(0, '6:30 Doors open\nafter-party?');
    await click('Read schedule');
    expect(host.textContent).toContain('We found 1 row');
    expect(host.textContent).toContain('We couldn’t read 1 line: ‘after-party?’');
    expect(titles()).toEqual([]);

    await click('Add these rows');
    expect(titles()).toEqual(['Doors open']);
  });

  it('saves on Next, reviews the agenda and saves again to finish', async () => {
    const { host, ref, saveSection, click, fill } = setup();
    fill(0, '18:30');
    fill(1, 'Doors open');
    await click('Add row');

    await click('Next');
    expect(saveSection).toHaveBeenCalledWith('e1', 'Agenda', {
      items: [{ startsAt: local(18, 30), title: 'Doors open', detail: null }],
    });
    expect(host.textContent).toContain('Here’s the agenda');
    expect(host.textContent).toContain('1 row, 6:30 pm');

    await click('Save');
    expect(saveSection).toHaveBeenCalledTimes(2);
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
