// Traces to: L2-178 AC1, L2-172 AC3 (docs/detailed-designs/events/build-hackathon-hub)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE, EventHubDto, RulesContent } from '@faithtech-community/api';
import { Observable, of } from 'rxjs';

import { HubRulesDialog } from './hub-rules.dialog';

function hub(content: RulesContent): EventHubDto {
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
    sections: [{ kind: 'Rules', visible: true, state: 'NeedsInfo', content }],
    organisation: {
      name: 'FaithTech Community',
      shortName: 'FaithTech',
      givingLink: null,
      givingText: null,
    },
    upcomingEvents: [],
  };
}

function setup(content: RulesContent = { rules: [], note: null }, answer?: () => Observable<void>) {
  const ref = { close: vi.fn() };
  const saveSection = vi.fn<() => Observable<void>>(answer ?? (() => of(undefined)));
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { saveSection } },
      { provide: DialogRef, useValue: ref },
      { provide: DIALOG_DATA, useValue: { hub: hub(content) } },
    ],
  });
  const fixture = TestBed.createComponent(HubRulesDialog);
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
  const field = (row: string, label: string) => {
    const group = Array.from(host.querySelectorAll('[role="group"]')).find(
      (g) => g.querySelector('h4')?.textContent?.trim() === row,
    )!;
    const labelEl = Array.from(group.querySelectorAll('label')).find((l) =>
      l.textContent?.trim().startsWith(label),
    )!;
    return host.querySelector<HTMLInputElement>(`#${labelEl.getAttribute('for')}`)!;
  };
  const fill = async (row: string, label: string, value: string) => {
    const input = field(row, label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  return { host, ref, saveSection, click, field, fill, settle };
}

describe('HubRulesDialog', () => {
  const rule = (title: string) => ({ title, detail: null });

  it('moves focus to the next rule’s title once a rule is removed', async () => {
    const { field, click } = setup({ rules: [rule('Start fresh'), rule('Any stack')], note: null });
    await click('Remove Start fresh');

    expect(document.activeElement).toBe(field('Rule 01', 'Title'));
    expect(field('Rule 01', 'Title').value).toBe('Any stack');
  });

  it('moves focus to Add a rule once the last rule is removed', async () => {
    const { host, click } = setup({ rules: [rule('Start fresh')], note: null });
    await click('Remove Start fresh');

    expect(host.textContent).toContain('No rules yet.');
    expect(document.activeElement?.textContent?.trim()).toBe('Add a rule');
  });
});
