// Traces to: L2-111
import { TestBed } from '@angular/core/testing';
import {
  PARTNERS_SERVICE,
  PartnerActivityDto,
  PartnerActivityPageDto,
} from '@faithtech-community/api';
import { Observable, of } from 'rxjs';

import { PartnerTimelineComponent } from './partner-timeline.component';

function entry(id: string, kind: PartnerActivityDto['kind'], text: string): PartnerActivityDto {
  return {
    id,
    kind,
    summary: text,
    text,
    occurredOn: '2026-10-20',
    occurredAt: null,
    nextStep: null,
    nextStepDue: null,
    loggedById: 'p1',
    loggedByName: 'Grace Okonkwo',
    loggedAtUtc: '2026-10-20T12:00:00Z',
    fromStage: null,
    toStage: null,
    relatedPartnerId: null,
    relatedPartnerName: null,
    mergedFromPartnerId: null,
    mergedFromPartnerName: null,
  };
}

async function setup(
  activities: (kind?: unknown, before?: unknown) => Observable<PartnerActivityPageDto>,
) {
  const service = {
    activities: vi.fn((_id: string, kind?: unknown, before?: unknown) => activities(kind, before)),
  };
  TestBed.configureTestingModule({ providers: [{ provide: PARTNERS_SERVICE, useValue: service }] });
  const fixture = TestBed.createComponent(PartnerTimelineComponent);
  fixture.componentRef.setInput('partnerId', 'x1');
  fixture.componentRef.setInput('canLog', true);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent!.trim() === name)!;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  return { host, service, settle, button, text };
}

describe('PartnerTimelineComponent', () => {
  it('pages with Show older, appending the next entries', async () => {
    const first = Array.from({ length: 50 }, (_, i) => entry(`a${i}`, 'Note', `Note ${i}`));
    const { host, service, settle, button } = await setup((_kind, before) =>
      of(
        before
          ? { items: [entry('b1', 'Call', 'Older call')], before: null }
          : { items: first, before: 'cursor-1' },
      ),
    );
    expect(host.querySelectorAll('ft-feed-item')).toHaveLength(50);

    button('Show older').click();
    await settle();

    expect(service.activities).toHaveBeenLastCalledWith('x1', null, 'cursor-1');
    expect(host.querySelectorAll('ft-feed-item')).toHaveLength(51);
    expect(button('Show older')).toBeUndefined();
  });

  it('filters by a chip, pressing only that chip, and counts the matches', async () => {
    const { service, settle, button, text } = await setup((kind) =>
      of({
        items: kind === 'Call' ? [entry('a1', 'Call', 'Called Nadia.')] : [],
        before: null,
      }),
    );

    button('Calls').click();
    await settle();

    expect(service.activities).toHaveBeenLastCalledWith('x1', 'Call');
    expect(button('Calls').getAttribute('aria-pressed')).toBe('true');
    expect(button('All').getAttribute('aria-pressed')).toBe('false');
    expect(text()).toContain('Call · Grace Okonkwo');
    expect(text()).toContain('1 call. Show all activity');
  });

  it('invites a lead to log the first touchpoint above the system entries', async () => {
    const { host, text, button } = await setup(() =>
      of({ items: [entry('a1', 'Added', 'Added Kestrel Labs as a lead')], before: null }),
    );

    expect(text()).toContain('No touchpoints yet');
    expect(button('Log activity')).toBeDefined();
    expect(host.querySelectorAll('ft-feed-item')).toHaveLength(1);
  });

  it('says which partner a merge moved an entry from', async () => {
    const moved = {
      ...entry('a1', 'Note', 'Nadia asked about hosting.'),
      mergedFromPartnerId: 'x2',
      mergedFromPartnerName: 'Kestrel Labs Inc.',
    };
    const { host } = await setup(() => of({ items: [moved], before: null }));

    expect(host.querySelector('ft-feed-item')!.textContent).toContain(
      'Tue 20 Oct · from Kestrel Labs Inc.',
    );
  });
});
