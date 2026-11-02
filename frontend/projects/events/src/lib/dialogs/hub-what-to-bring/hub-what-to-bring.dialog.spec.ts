// Traces to: L2-174 AC1, L2-172 AC3, L2-157 AC2 (docs/detailed-designs/events/build-hackathon-hub)
import { HttpErrorResponse } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto, WhatToBringContent } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubWhatToBringDialog } from './hub-what-to-bring.dialog';

function hub(content: WhatToBringContent): EventHubDto {
  return {
    id: 'h1',
    eventId: 'e1',
    status: 'Draft',
    publishedAt: null,
    templateKey: 'hackathon',
    link: 'https://app.faithtech.community/public/events/e1/hub',
    event: {
      title: 'SoCal Hackathon',
      startsAt: '2026-10-24T16:00:00.000Z',
      endsAt: '2026-10-25T01:00:00.000Z',
      format: 'InPerson',
      venue: null,
      onlineLink: null,
      rsvpLink: 'https://app.faithtech.community/public/events/e1',
      isCancelled: false,
    },
    sections: [{ kind: 'WhatToBring', visible: true, state: 'NeedsInfo', content }],
    organisation: {
      name: 'FaithTech Community',
      shortName: 'FaithTech',
      givingLink: null,
      givingText: null,
    },
    upcomingEvents: [],
  };
}

function setup(
  content: WhatToBringContent = { bring: [], onTheDay: [] },
  answer?: () => Observable<void>,
) {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn<() => Observable<void>>(answer ?? (() => of(undefined)));
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub: hub(content) } },
    ],
  });
  const fixture = TestBed.createComponent(HubWhatToBringDialog);
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
      .find((b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name)!
      .click();
    await settle();
  };
  /** A field by its label, inside the row card with `row` as its heading when given. */
  const field = (label: string, row?: string) => {
    const scope = row
      ? Array.from(host.querySelectorAll('[role="group"]')).find(
          (g) => g.querySelector('h4')?.textContent?.trim() === row,
        )!
      : host;
    const labelEl = Array.from(scope.querySelectorAll('label')).find(
      (l) => l.textContent?.trim().replace(/\s+/g, ' ').split(' (')[0] === label,
    )!;
    return host.querySelector<HTMLInputElement>(`#${labelEl.getAttribute('for')}`)!;
  };
  const fill = async (label: string, value: string, row?: string) => {
    const input = field(label, row);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const question = () => host.querySelector('h3')?.textContent?.trim();
  return { host, ref, saveSection, click, field, fill, question };
}

describe('HubWhatToBringDialog', () => {
  it('asks what to bring, and says when there is nothing yet', () => {
    const { host, question } = setup();
    expect(question()).toBe('What should people bring?');
    expect(host.textContent).toContain('Nothing to bring yet.');
  });

  it('saves on Next, asks about the day and saves both lists to finish', async () => {
    const { ref, saveSection, click, fill, question } = setup();
    await click('Add an item');
    await fill('Item 1', ' Your laptop and charger ');
    await click('Next');

    expect(saveSection).toHaveBeenCalledWith('e1', 'WhatToBring', {
      bring: ['Your laptop and charger'],
      onTheDay: [],
    });
    expect(question()).toBe('What should people expect on the day?');

    await click('Add a line');
    await fill('Title', 'Raise a hand', 'Line 01');
    await click('Save');

    expect(saveSection).toHaveBeenLastCalledWith('e1', 'WhatToBring', {
      bring: ['Your laptop and charger'],
      onTheDay: [{ title: 'Raise a hand', detail: null }],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('opens with what was saved, and Save and finish later closes once saved', async () => {
    const { ref, saveSection, click, field } = setup({
      bring: ['Your laptop', 'Your phone'],
      onTheDay: [{ title: 'Candid photos', detail: 'Tell a host.' }],
    });
    expect(field('Item 2').value).toBe('Your phone');
    await click('Move Your phone up');
    await click('Save and finish later');

    expect(saveSection).toHaveBeenCalledWith('e1', 'WhatToBring', {
      bring: ['Your phone', 'Your laptop'],
      onTheDay: [{ title: 'Candid photos', detail: 'Tell a host.' }],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays on the step with the server’s message on the item', async () => {
    const refused = new HttpErrorResponse({
      status: 400,
      error: { errors: { 'Bring[0]': ['Say what to bring.'] } },
    });
    const { host, ref, click, question } = setup(undefined, () => throwError(() => refused));
    await click('Add an item');
    await click('Next');

    expect(question()).toBe('What should people bring?');
    expect(host.textContent).toContain('Say what to bring.');
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('says it couldn’t save and tries again', async () => {
    let calls = 0;
    const { host, ref, click } = setup(undefined, () =>
      ++calls === 1 ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(undefined),
    );
    await click('Save and finish later');
    expect(host.textContent).toContain('We couldn’t save this section');

    await click('Try again');
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
