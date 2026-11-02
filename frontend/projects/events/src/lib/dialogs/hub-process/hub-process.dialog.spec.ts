// Traces to: L2-177 AC1, L2-172 AC3, L2-157 AC2 (docs/detailed-designs/events/build-hackathon-hub)
import { HttpErrorResponse } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto, ProcessContent } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubProcessDialog } from './hub-process.dialog';

function hub(content: ProcessContent): EventHubDto {
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
    sections: [{ kind: 'Process', visible: true, state: 'NeedsInfo', content }],
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
  content: ProcessContent = { name: null, intro: null, stages: [] },
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
  const fixture = TestBed.createComponent(HubProcessDialog);
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

const lament = {
  title: 'Lament',
  when: null,
  summary: null,
  points: [
    { title: 'Listen', detail: 'Whose pain have you heard?' },
    { title: 'Remember', detail: null },
  ],
};

describe('HubProcessDialog', () => {
  it('names the process on Next, then saves a stage whose points are “Title: detail” lines', async () => {
    const { ref, saveSection, click, fill, question } = setup();
    expect(question()).toBe('What do you call your process?');
    await fill('Name', 'The Create Cycle');
    await click('Next');

    expect(saveSection).toHaveBeenCalledWith('e1', 'Process', {
      name: 'The Create Cycle',
      intro: null,
      stages: [],
    });
    expect(question()).toBe('Stages');

    await click('Add a stage');
    await fill('Title', 'Lament', 'Stage 01');
    await fill('Points', 'Listen: Whose pain have you heard?\n\n  Remember  \n', 'Stage 01');
    await click('Save');

    expect(saveSection).toHaveBeenLastCalledWith('e1', 'Process', {
      name: 'The Create Cycle',
      intro: null,
      stages: [lament],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('opens with the saved stages, their points one per line', async () => {
    const { host, click, field } = setup({
      name: 'The Create Cycle',
      intro: null,
      stages: [lament],
    });
    await click('Next');

    expect(field('Points', 'Stage 01').value).toBe('Listen: Whose pain have you heard?\nRemember');
    expect(host.textContent).toContain('One per line, as “Title: detail”. 2 of 6 lines.');
  });

  it('shows the stage that the server refused, with its message on the points', async () => {
    const refused = new HttpErrorResponse({
      status: 400,
      error: { errors: { 'Stages[0].Points[1].Title': ['Give this point a title.'] } },
    });
    const { host, click, question } = setup({ name: null, intro: null, stages: [lament] }, () =>
      throwError(() => refused),
    );
    await click('Save and finish later');

    expect(question()).toBe('Stages');
    expect(host.textContent).toContain('Give this point a title.');
  });
});
