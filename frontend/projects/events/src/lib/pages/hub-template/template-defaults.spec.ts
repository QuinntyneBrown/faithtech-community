import { HubTemplateDetailDto } from '@faithtech-community/api';

import { clock, defaultSummary, standInHub, toTemplateContent } from './template-defaults';

const template: HubTemplateDetailDto = {
  id: 't1',
  name: 'Meetup',
  description: 'An evening of talks and conversation.',
  archived: false,
  archivedAtUtc: null,
  hubCount: 0,
  sections: [
    { kind: 'Hero', visible: true, content: { subtitle: 'An evening for Christians who build.' } },
    {
      kind: 'Agenda',
      visible: true,
      content: {
        items: [
          { minutes: 0, title: 'Doors open', detail: null },
          { minutes: 90, title: 'Conversation', detail: 'Over coffee.' },
        ],
      },
    },
  ],
  organisation: { name: 'FaithTech', shortName: 'FaithTech', givingLink: null, givingText: null },
};

describe('template defaults', () => {
  it('says what new hubs get for each section', () => {
    expect(defaultSummary('Hero', { subtitle: 'Hello' })).toBe('Default: “Hello”');
    expect(defaultSummary('Agenda', template.sections[1].content)).toBe(
      'Default: 2 rows, 9:00 am to 10:30 am',
    );
    expect(defaultSummary('Rules', { rules: [{}, {}] })).toBe('Default: 2 rules');
    expect(
      defaultSummary('DemoFormat', { minutes: 3, questionMinutes: 2, segments: [{}, {}, {}, {}] }),
    ).toBe('Default: 3 minutes · 4 segments · 2 minutes of questions');
    expect(defaultSummary('Tracks', null)).toBe('No default text yet');
    expect(defaultSummary('People', null)).toBe('Filled in on each hub, from your members.');
  });

  it('reads times after a 9:00 am start', () => {
    expect(clock(0)).toBe('9:00 am');
    expect(clock(180)).toBe('12:00 pm');
    expect(clock(540)).toBe('6:00 pm');
  });

  it('opens the wizards on a 9:00 am stand-in and saves the agenda back in minutes', () => {
    const { hub, start } = standInHub(template);

    expect(start.getHours()).toBe(9);
    expect(hub.event.startsAt).toBe(start.toISOString());
    expect(hub.sections.map((s) => s.kind)).toHaveLength(17);
    expect(hub.sections.find((s) => s.kind === 'Tracks')?.content).toEqual({
      tracks: [],
      goodLooksLike: [],
    });
    const agenda = hub.sections.find((s) => s.kind === 'Agenda')!.content as {
      items: { startsAt: string }[];
    };
    expect(new Date(agenda.items[1].startsAt).getTime() - start.getTime()).toBe(90 * 60000);

    expect(toTemplateContent('Agenda', agenda, start)).toEqual(template.sections[1].content);
    expect(toTemplateContent('Hero', { subtitle: 'x' }, start)).toEqual({ subtitle: 'x' });
  });
});
