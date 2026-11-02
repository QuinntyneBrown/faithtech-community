// Traces to: L2-179 AC1, AC2, L2-172 AC3 (docs/detailed-designs/events/build-hackathon-hub)
import { HttpErrorResponse } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto, DemoFormatContent } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubDemoFormatDialog } from './hub-demo-format.dialog';

function hub(content: DemoFormatContent): EventHubDto {
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
    sections: [{ kind: 'DemoFormat', visible: true, state: 'NeedsInfo', content }],
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
  content: DemoFormatContent = { minutes: null, questionMinutes: null, segments: [], tips: [] },
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
  const fixture = TestBed.createComponent(HubDemoFormatDialog);
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
  const total = () => host.querySelector('ft-field-total');
  const question = () => host.querySelector('h3')?.textContent?.trim();
  return { host, ref, saveSection, click, field, fill, total, question };
}

describe('HubDemoFormatDialog', () => {
  it('asks how demos run, with no segments yet and no minutes to fit them in', () => {
    const { host, total, question } = setup();
    expect(question()).toBe('How do demos run?');
    expect(host.textContent).toContain('No segments yet.');
    expect(total()?.getAttribute('role')).toBe('status');
    expect(total()?.textContent?.trim()).toBe('Segments: 0:00 of –');
  });

  it('totals the segments live, shows the server’s over-time message, and saves once they fit', async () => {
    const refused = new HttpErrorResponse({
      status: 400,
      error: { errors: { Segments: ['The segments run 3:30. Make them fit in 3 minutes.'] } },
    });
    let calls = 0;
    const { host, ref, saveSection, click, fill, total } = setup(undefined, () =>
      ++calls === 1 ? throwError(() => refused) : of(undefined),
    );
    await fill('Minutes per demo', '3');
    await fill('Minutes for questions', '2');
    await click('Add a segment');
    await fill('Title', 'Your track', 'Segment 01');
    await fill('Length in seconds', '120', 'Segment 01');
    await click('Add a segment');
    await fill('Title', 'Tend', 'Segment 02');
    await fill('Length in seconds', '90', 'Segment 02');

    expect(total()?.textContent?.trim()).toBe('Segments: 3:30 of 3:00');
    expect(total()?.classList).toContain('ft-field-total--off');

    await click('Save');
    expect(host.textContent).toContain('The segments run 3:30. Make them fit in 3 minutes.');
    expect(ref.close).not.toHaveBeenCalled();

    await fill('Length in seconds', '60', 'Segment 02');
    expect(total()?.textContent?.trim()).toBe('Segments: 3:00 of 3:00');
    expect(total()?.classList).not.toContain('ft-field-total--off');
    await click('Add a tip');
    await fill('Tip 1', 'Demo on a phone');
    await click('Save');

    expect(saveSection).toHaveBeenLastCalledWith('e1', 'DemoFormat', {
      minutes: 3,
      questionMinutes: 2,
      segments: [
        { title: 'Your track', detail: null, seconds: 120 },
        { title: 'Tend', detail: null, seconds: 60 },
      ],
      tips: ['Demo on a phone'],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('opens with the saved format', () => {
    const { field, total } = setup({
      minutes: 3,
      questionMinutes: 0,
      segments: [{ title: 'Tend', detail: 'Show it working.', seconds: 90 }],
      tips: ['Have a backup video'],
    });
    expect(field('Minutes for questions').value).toBe('0');
    expect(field('Detail', 'Segment 01').value).toBe('Show it working.');
    expect(field('Tip 1').value).toBe('Have a backup video');
    expect(total()?.textContent?.trim()).toBe('Segments: 1:30 of 3:00');
  });
});
