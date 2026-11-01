import type { HubSectionKind } from './mock-event-hubs';

/** A template section as the API stores it: Agenda rows hold minutes from the event's start (ADR 0041). */
export interface MockHubTemplateSection {
  kind: HubSectionKind;
  visible: boolean;
  content: Record<string, unknown> | null;
}

export interface MockHubTemplate {
  id: string;
  name: string;
  description: string;
  sections: MockHubTemplateSection[];
}

const KINDS: HubSectionKind[] = [
  'Hero',
  'Agenda',
  'Venue',
  'People',
  'Links',
  'Giving',
  'UpcomingEvents',
];

type Row = [minutes: number, title: string, detail?: string];

function template(
  id: string,
  name: string,
  description: string,
  hidden: HubSectionKind[],
  subtitle: string,
  agenda: Row[],
  giving: string | null,
): MockHubTemplate {
  const content: Partial<Record<HubSectionKind, Record<string, unknown>>> = {
    Hero: { subtitle },
    Agenda: {
      items: agenda.map(([minutes, title, detail]) => ({ minutes, title, detail: detail ?? null })),
    },
    UpcomingEvents: { count: 3 },
    ...(giving ? { Giving: { line: giving } } : {}),
  };
  return {
    id,
    name,
    description,
    sections: KINDS.map((kind) => ({
      kind,
      visible: !hidden.includes(kind),
      content: content[kind] ?? null,
    })),
  };
}

/** FaithTech's hub templates, as the seed has them (L2-171 AC2). */
export function faithTechHubTemplates(): MockHubTemplate[] {
  return [
    template(
      '9a1c4e2b-6d3f-4b8a-9e10-4c5d6e7f8a01',
      'Hackathon',
      'A day of building in teams, with demos at the end.',
      [],
      'One day to build for the church. Form a team and ship something real.',
      [
        [0, 'Doors, check-in and breakfast'],
        [15, 'Worship', 'Three songs, about 15 minutes.'],
        [30, 'Welcome and overview', 'Who we are and the plan for the day.'],
        [60, 'Form teams', 'Go to your track’s corner of the room.'],
        [180, 'Lunch'],
        [210, 'Build starts', 'Pray, prototype, pause. Repeat.'],
        [420, 'Code freeze', 'Submit your project to get a demo slot.'],
        [435, 'Demos', 'Three minutes per team, then two minutes of questions.'],
        [510, 'Team honors'],
        [540, 'Next steps and commissioning', 'What comes next, then we pray and send.'],
      ],
      'Help us build the next one.',
    ),
    template(
      '9a1c4e2b-6d3f-4b8a-9e10-4c5d6e7f8a02',
      'Meetup',
      'An evening of talks and conversation.',
      ['Links'],
      'An evening of conversation for Christians who build.',
      [
        [0, 'Doors open', 'Grab a drink and find a seat.'],
        [30, 'Welcome and prayer'],
        [45, 'Talks'],
        [90, 'Conversation and connection'],
      ],
      'Help us host the next one.',
    ),
    template(
      '9a1c4e2b-6d3f-4b8a-9e10-4c5d6e7f8a03',
      'Workshop',
      'A hands-on session with one facilitator.',
      ['Links', 'Giving'],
      'Bring your laptop. We’ll learn by doing.',
      [
        [0, 'Welcome and setup', 'Get on the wifi and open the starter files.'],
        [15, 'Teaching'],
        [60, 'Hands-on time', 'Work through the exercises in pairs.'],
        [105, 'Share back'],
      ],
      null,
    ),
  ];
}
