// Traces to: L2-157 AC2, AC4; L2-158 AC1 (docs/detailed-designs/events/fill-in-hub-sections)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubHeroDialog } from './hub-hero.dialog';

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

function setup(saveSection = vi.fn<() => Observable<void>>(() => of(undefined))) {
  const ref = { close: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub: hubFixture() } },
    ],
  });
  const fixture = TestBed.createComponent(HubHeroDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const input = host.querySelector<HTMLInputElement>('input')!;
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const save = async () => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Save')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, saveSection, input, type, save };
}

describe('HubHeroDialog', () => {
  it('shows the event’s facts and starts from the saved subtitle', () => {
    const { host, input } = setup();

    expect(host.textContent).toContain('What should the top of the hub say?');
    expect(host.textContent).toContain('Toronto Builders Night');
    expect(host.textContent).toContain('Kestrel Labs, 220 King St W, Toronto');
    expect(input.value).toBe('A night of building');
  });

  it('refuses a subtitle past 140 characters without asking the server', async () => {
    const { host, saveSection, type, save } = setup();

    type('x'.repeat(141));
    await save();

    expect(host.textContent).toContain('Use 140 characters or fewer.');
    expect(saveSection).not.toHaveBeenCalled();
  });

  it('saves the trimmed subtitle, or none, and closes', async () => {
    const { ref, saveSection, type, save } = setup();

    type('  ');
    await save();

    expect(saveSection).toHaveBeenCalledWith('e1', 'Hero', { subtitle: null });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('keeps the input and offers Try again when the save fails', async () => {
    const { host, ref, type, save } = setup(
      vi.fn<() => Observable<void>>(() => throwError(() => new HttpErrorResponse({ status: 500 }))),
    );

    type('A night of building for the city');
    await save();

    expect(host.textContent).toContain('We couldn’t save this section');
    expect(host.querySelector<HTMLInputElement>('input')!.value).toBe(
      'A night of building for the city',
    );
    expect(ref.close).not.toHaveBeenCalled();
  });
});
