// Traces to: L2-161 AC1, AC3 (docs/detailed-designs/events/fill-in-hub-sections)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto, PEOPLE_SERVICE } from '@faithtech-community/api';
import { Observable, of } from 'rxjs';

import { HubPeopleDialog } from './hub-people.dialog';

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

function setup() {
  const saveSection = vi.fn<() => Observable<void>>(() => of(undefined));
  const base = hubFixture();
  const hub: EventHubDto = {
    ...base,
    sections: [{ kind: 'People', visible: true, state: 'NeedsInfo', content: { people: [] } }],
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: PEOPLE_SERVICE, useValue: { search: vi.fn() } },
      { provide: DialogRef, useValue: { close: vi.fn() } },
      { provide: DIALOG_DATA, useValue: { hub } },
    ],
  });
  const fixture = TestBed.createComponent(HubPeopleDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const click = async (name: string) => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === name)!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  const fill = (label: string, value: string) => {
    const field = Array.from(host.querySelectorAll('ft-form-field')).find((f) =>
      f.textContent?.trim().startsWith(label),
    )!;
    const input = field.querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  return { host, saveSection, click, fill };
}

describe('HubPeopleDialog', () => {
  it('asks for a guest’s name, then adds them as a guest and saves them on Next', async () => {
    const { host, saveSection, click, fill } = setup();
    expect(host.textContent).toContain('No one yet. Add a member or a guest.');

    await click('Add a guest');
    await click('Add guest');
    expect(host.textContent).toContain('Enter their name.');

    fill('Name', 'Nadia Farouk');
    fill('About them', 'Founder, Kestrel Labs');
    await click('Add guest');
    expect(host.textContent).toContain('Guest · Founder, Kestrel Labs');

    await click('Next');
    expect(saveSection).toHaveBeenCalledWith('e1', 'People', {
      people: [
        { profileId: null, name: 'Nadia Farouk', line: 'Founder, Kestrel Labs', role: 'Mentor' },
      ],
    });
    expect(host.textContent).toContain('Here’s who’s helping');
  });
});
