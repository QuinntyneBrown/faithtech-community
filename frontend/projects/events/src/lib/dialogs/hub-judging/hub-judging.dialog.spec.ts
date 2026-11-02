// Traces to: L2-180 AC1, AC2; L2-172 AC3 (docs/detailed-designs/events/build-hackathon-hub)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto, JudgingContent } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { HubJudgingDialog } from './hub-judging.dialog';

function hubWith(content: JudgingContent | null): EventHubDto {
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
    sections: content
      ? [{ kind: 'Judging', visible: true, state: 'Ready', content }]
      : [{ kind: 'Judging', visible: true, state: 'NeedsInfo', content: null as never }],
    organisation: {
      name: 'FaithTech Community',
      shortName: 'FaithTech',
      givingLink: null,
      givingText: null,
    },
    upcomingEvents: [],
  } as EventHubDto;
}

function setup(
  content: JudgingContent | null = null,
  saveSection = vi.fn<() => Observable<void>>(() => of(undefined)),
) {
  const ref = { close: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub: hubWith(content) } },
    ],
  });
  const fixture = TestBed.createComponent(HubJudgingDialog);
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
      .find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)!
      .click();
    await settle();
  };
  const row = (heading: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('[role="group"]')).find(
      (g) => g.querySelector('h4')?.textContent?.trim() === heading,
    )!;
  const control = (scope: HTMLElement, label: string) => {
    const l = Array.from(scope.querySelectorAll('label')).find((x) =>
      x.textContent?.trim().startsWith(label),
    )!;
    return host.querySelector<HTMLInputElement | HTMLSelectElement>(`#${l.htmlFor}`)!;
  };
  const fill = async (scope: HTMLElement, label: string, value: string) => {
    const input = control(scope, label);
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    await settle();
  };
  const question = () => host.querySelector('h3')?.textContent?.trim();
  const total = () => host.querySelector('[role="status"]')?.textContent?.trim();
  return { host, ref, saveSection, click, row, control, fill, question, total, settle };
}

describe('HubJudgingDialog', () => {
  it('asks how judges score, with the top score in its help', async () => {
    const { host, fill, question } = setup();
    expect(question()).toBe('How do judges score?');
    expect(host.textContent).toContain('Judges score each team 1 to 5');
    expect(host.textContent).toContain('No criteria yet.');

    await fill(host, 'Top score', '7');
    expect(host.textContent).toContain('Judges score each team 1 to 7');
  });

  it('keeps a live total of the weights', async () => {
    const { host, click, row, fill, total } = setup();
    await click('Add a criterion');
    await fill(row('Criterion 01'), 'Criterion', 'Redemptive potential');
    await fill(row('Criterion 01'), 'Weight %', '60');
    await click('Add a criterion');
    await fill(row('Criterion 02'), 'Weight %', '30');
    expect(total()).toBe('Weights add up to 90%');
    expect(host.querySelector('ft-field-total')?.classList).toContain('ft-field-total--off');

    await fill(row('Criterion 01'), 'Weight %', '70');
    expect(total()).toBe('Weights total 100%');
    expect(host.querySelector('ft-field-total')?.classList).not.toContain('ft-field-total--off');
  });

  it('stays on the criteria when the server refuses the weights', async () => {
    const saveSection = vi.fn<() => Observable<void>>(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { Criteria: ['Weights add up to 90%. Make them total 100%.'] } },
          }),
      ),
    );
    const { host, click, row, fill, question } = setup(null, saveSection);
    await click('Add a criterion');
    await fill(row('Criterion 01'), 'Criterion', 'Redemptive potential');
    await fill(row('Criterion 01'), 'Weight %', '90');

    await click('Next');

    expect(question()).toBe('How do judges score?');
    expect(host.textContent).toContain('Weights add up to 90%. Make them total 100%.');
  });

  it('saves the whole section on Next, then the honors on Save', async () => {
    const { ref, saveSection, click, row, fill, question, host } = setup();
    await fill(host, 'Top score', '5');
    await click('Add a criterion');
    await fill(row('Criterion 01'), 'Criterion', 'Redemptive potential');
    await fill(row('Criterion 01'), 'Weight %', '100');

    await click('Next');
    expect(saveSection).toHaveBeenCalledWith('e1', 'Judging', {
      topScore: 5,
      criteria: [{ title: 'Redemptive potential', question: null, topMark: null, weight: 100 }],
      honors: [],
      note: null,
    });
    expect(question()).toBe('What can teams win?');

    await click('Add an honor');
    await fill(row('Honor 01'), 'Honor', 'Most Creative');
    await fill(row('Honor 01'), 'How it’s chosen', 'JudgesPick');
    await fill(host, 'Note', 'Coffee for the winners.');
    await click('Save');

    expect(saveSection).toHaveBeenLastCalledWith('e1', 'Judging', {
      topScore: 5,
      criteria: [{ title: 'Redemptive potential', question: null, topMark: null, weight: 100 }],
      honors: [{ title: 'Most Creative', line: null, chosenBy: 'JudgesPick' }],
      note: 'Coffee for the winners.',
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('opens with what the hub already holds', async () => {
    const { host, row, control, click, total } = setup({
      topScore: 4,
      criteria: [
        { title: 'Usable', question: 'Could a pastor use it?', topMark: null, weight: 100 },
      ],
      honors: [{ title: 'Most Redemptive', line: 'Ready for impact.', chosenBy: 'Vote' }],
      note: 'Bags of coffee.',
    });
    expect(control(host, 'Top score').value).toBe('4');
    expect(control(row('Criterion 01'), 'Criterion').value).toBe('Usable');
    expect(control(row('Criterion 01'), 'Question').value).toBe('Could a pastor use it?');
    expect(total()).toBe('Weights total 100%');

    await click('Next');
    expect(control(row('Honor 01'), 'How it’s chosen').value).toBe('Vote');
    expect(control(host, 'Note').value).toBe('Bags of coffee.');
  });

  it('after Remove, focuses the next criterion, or Add a criterion when none follows', async () => {
    const { host, click, row, fill, control, settle } = setup();
    await click('Add a criterion');
    await click('Add a criterion');
    await fill(row('Criterion 02'), 'Criterion', 'Usable');

    await click('Remove Criterion 01');
    await settle();
    expect(document.activeElement).toBe(control(row('Criterion 01'), 'Criterion'));

    await click('Remove Usable');
    await settle();
    expect(document.activeElement?.textContent?.trim()).toBe('Add a criterion');
    expect(host.textContent).toContain('No criteria yet.');
  });

  it('shows the alert with Try again when the save fails', async () => {
    const saveSection = vi.fn<() => Observable<void>>(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const { host, click } = setup(null, saveSection);
    await click('Next');
    expect(host.textContent).toContain('We couldn’t save this section');
    await click('Try again');
    expect(saveSection).toHaveBeenCalledTimes(2);
  });
});
