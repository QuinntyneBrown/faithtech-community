// Traces to: L2-158 AC3, AC5 (docs/detailed-designs/events/fill-in-hub-sections)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { of } from 'rxjs';

import { HubGivingDialog } from './hub-giving.dialog';

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

function setup(hub = hubFixture()) {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn(() => of(undefined));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub } },
    ],
  });
  const fixture = TestBed.createComponent(HubGivingDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const save = async () => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Save')!
      .click();
    await fixture.whenStable();
  };
  return { host, ref, saveSection, save };
}

describe('HubGivingDialog', () => {
  it('shows the organisation’s giving link and text and saves the event line', async () => {
    const { host, ref, saveSection, save } = setup();

    expect(host.textContent).toContain('https://faithtech.com/donate');
    expect(host.textContent).toContain('Help us build the next one.');
    await save();

    expect(saveSection).toHaveBeenCalledWith('e1', 'Giving', {
      line: 'Tonight’s gifts fund the build.',
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('says where to add a missing giving link', () => {
    const hub = hubFixture();
    const { host } = setup({
      ...hub,
      organisation: { ...hub.organisation, givingLink: null, givingText: null },
    });

    expect(host.textContent).toContain('FaithTech hasn’t added a giving link yet.');
  });
});
