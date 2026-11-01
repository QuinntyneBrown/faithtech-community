// Traces to: L2-160 AC3 (docs/detailed-designs/events/fill-in-hub-sections)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { Observable, of } from 'rxjs';

import { HubLinksDialog } from './hub-links.dialog';

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

function setup(agenda: boolean) {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn<() => Observable<void>>(() => of(undefined));
  const base = hubFixture();
  const at = new Date(2026, 10, 6, 20).toISOString();
  const hub: EventHubDto = {
    ...base,
    sections: [
      {
        kind: 'Agenda',
        visible: true,
        state: agenda ? 'Ready' : 'NeedsInfo',
        content: { items: agenda ? [{ startsAt: at, title: 'Code freeze', detail: null }] : [] },
      },
    ],
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub } },
    ],
  });
  const fixture = TestBed.createComponent(HubLinksDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  const fill = (index: number, value: string) => {
    const input = host.querySelectorAll<HTMLInputElement>('input')[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const save = async () => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Save')!
      .click();
    await settle();
  };
  return { host, ref, saveSection, fill, save, at };
}

describe('HubLinksDialog', () => {
  it('refuses a link that is not https without saving', async () => {
    const { host, saveSection, fill, save } = setup(false);
    fill(0, 'http://forms.example.org');
    await save();

    expect(host.textContent).toContain('Use a link that starts with https://');
    expect(saveSection).not.toHaveBeenCalled();
  });

  it('disables the code freeze until there is an agenda', () => {
    const { host } = setup(false);
    expect(host.querySelector('select')!.disabled).toBe(true);
    expect(host.textContent).toContain('Add an agenda first to pick a code-freeze time.');
  });

  it('saves the links and the code freeze picked from the agenda', async () => {
    const { host, ref, saveSection, fill, save, at } = setup(true);
    const select = host.querySelector('select')!;
    expect(select.disabled).toBe(false);
    fill(1, 'https://forms.example.org/feedback');
    select.value = at;
    select.dispatchEvent(new Event('change'));
    await save();

    expect(saveSection).toHaveBeenCalledWith('e1', 'Links', {
      submissionUrl: null,
      feedbackUrl: 'https://forms.example.org/feedback',
      codeFreezeAt: at,
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
