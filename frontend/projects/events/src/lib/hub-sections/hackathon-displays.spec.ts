// Traces to: L2-177 AC2, L2-180 AC3 (docs/detailed-designs/events/build-hackathon-hub)
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EventHubDto, HubSectionKind } from '@faithtech-community/api';

import { HubJudgingComponent } from './hub-judging.component';
import { HubProcessComponent } from './hub-process.component';

function render(component: Type<unknown>, kind: HubSectionKind, content: unknown) {
  const hub = { eventId: 'e1', sections: [{ kind, content }] } as unknown as EventHubDto;
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput('hub', hub);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('hackathon displays', () => {
  it('scores to the top score and names each criterion with its weight', () => {
    const host = render(HubJudgingComponent, 'Judging', {
      topScore: 4,
      criteria: [
        { title: 'Usable', question: 'Could a pastor use it?', topMark: 'Today.', weight: 100 },
      ],
      honors: [{ title: 'Most Creative', line: null, chosenBy: 'MentorsPick' }],
      note: null,
    });

    expect(host.textContent).toContain('Judges score each team 1 to 4 on each criterion.');
    expect(host.querySelector('caption')?.textContent).toContain('How judges score');
    expect(host.textContent).toContain('Scores a 4 when');
    expect(host.textContent).toContain('Usable (100%)');
    expect(host.textContent).toContain('Honor 01 · Mentors’ pick');
  });

  it('heads the process with its own name, or Process when it has none', () => {
    const stages = [{ title: 'Lament', when: null, summary: null, points: [] }];
    const named = render(HubProcessComponent, 'Process', {
      name: 'The Create Cycle',
      intro: null,
      stages,
    });
    expect(named.querySelector('h3')?.textContent?.trim()).toBe('The Create Cycle');

    const unnamed = render(HubProcessComponent, 'Process', { name: null, intro: null, stages });
    expect(unnamed.querySelector('h3')?.textContent?.trim()).toBe('Process');
  });
});
