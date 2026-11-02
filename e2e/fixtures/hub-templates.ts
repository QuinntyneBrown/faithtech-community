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

/** Every kind in catalogue order (L2-172 AC1); the core ones are the ones every template names. */
const ALL: HubSectionKind[] = [
  'Hero',
  'Agenda',
  'Venue',
  'Parking',
  'WhatToBring',
  'Partners',
  'Tracks',
  'Process',
  'Rules',
  'People',
  'Links',
  'DemoFormat',
  'Judging',
  'Worship',
  'Slides',
  'Giving',
  'UpcomingEvents',
];

const CORE: HubSectionKind[] = ['Hero', 'Agenda', 'Venue', 'People', 'Links', 'Giving', 'UpcomingEvents'];

const titled = (...items: [string, string][]) => items.map(([title, detail]) => ({ title, detail }));

/** The hackathon sections' defaults, as the seed has them (L2-183 AC2); the event-specific ones start empty. */
const HACKATHON: Partial<Record<HubSectionKind, Record<string, unknown>>> = {
  WhatToBring: {
    bring: [
      'Your laptop and charger',
      'Your phone, for testing and demos',
      'A GitHub account and your username, for your team’s public repo',
      'Logins for the AI and dev tools you like to use',
    ],
    onTheDay: titled(
      ['Raise a hand', 'Mentors walk the floor every hour. Stuck for 15 minutes? Ask.'],
      ['Candid photos', 'We’ll be taking photos. Rather not be in them? Tell a host.'],
      ['Close the loop', 'If you make a commitment, honor it.'],
    ),
  },
  Process: {
    name: 'The Create Cycle',
    intro:
      'Redemptive technology starts before the code. Every team moves through the same four movements.',
    stages: [
      {
        title: 'Lament',
        when: null,
        summary: 'We patiently refuse to rush past pain.',
        points: titled(
          ['Listen', 'Who does your track serve? Whose pain have you heard?'],
          ['Remember', 'Name the pain honestly. Who’s left out, and why?'],
          ['Repent', 'What in us needs to change?'],
          ['Rejoice', 'Where have you already seen God at work?'],
        ),
      },
      {
        title: 'Discern',
        when: null,
        summary: 'We seek God’s wisdom before choosing a response.',
        points: titled(
          ['Ideate', 'Get every idea out. No critique yet.'],
          ['Map the path', 'Clarify the scope and what you hope to build today.'],
          ['Choose a direction', 'Reject, receive, reimagine or create?'],
        ),
      },
      {
        title: 'Build',
        when: null,
        summary: 'We faithfully build in dependence on the Spirit.',
        points: titled(
          ['Pray, prototype, pause', 'A rhythm, all afternoon. Repeat.'],
          ['Prayer pause', 'Is this still what we discerned? Are people being loved well?'],
        ),
      },
      {
        title: 'Steward',
        when: null,
        summary: 'We take responsibility for what we release.',
        points: titled(
          ['Tend', 'Show it working, live.'],
          ['Examine', 'The fruit and the risks.'],
          ['Testify', 'What God did in your team.'],
        ),
      },
    ],
  },
  Rules: {
    rules: titled(
      ['Start fresh', 'The code starts today.'],
      ['Any stack', 'Open source, APIs and AI tools welcome.'],
      ['Test data only', 'No real personal data from churches.'],
      ['Credit your sources', 'Name the tools and templates you used.'],
      ['Code freeze', 'Working beats perfect.'],
      ['Public repo', 'Keeps the code open for others to steward.'],
    ),
    note: null,
  },
  DemoFormat: {
    minutes: 3,
    questionMinutes: 2,
    segments: [
      { title: 'Your track', detail: 'Who it’s for.', seconds: 30 },
      { title: 'Tend', detail: 'Show it working, live.', seconds: 90 },
      { title: 'Examine', detail: 'The fruit and the risks.', seconds: 30 },
      { title: 'Testify', detail: 'What God did in your team.', seconds: 30 },
    ],
    tips: ['Demo on a phone', 'Have a backup video', 'Start with a person'],
  },
  Judging: {
    topScore: 5,
    criteria: [
      {
        title: 'Redemptive potential',
        question: 'Could this advance the gospel and reach real people, beyond the demo?',
        topMark: 'Real people could meet, follow or share Jesus through it long after today.',
        weight: 40,
      },
      {
        title: 'Usable by the end user',
        question:
          'Could a pastor, a new believer or a church volunteer use it without us in the room?',
        topMark: 'A pastor or volunteer could pick it up today with no help.',
        weight: 30,
      },
      {
        title: 'Technical viability',
        question: 'Does it work live, end to end?',
        topMark: 'It runs live, end to end, with nothing faked.',
        weight: 30,
      },
    ],
    honors: [
      {
        title: 'Most Redemptive',
        line: 'Deployable and ready for impact: viable, and built in the way of Jesus.',
        chosenBy: 'TopScore',
      },
      {
        title: 'Most Collaborative',
        line: 'Built best together. Every member shaped the work.',
        chosenBy: 'MentorsPick',
      },
      {
        title: 'Most Creative',
        line: 'The most imaginative answer to the challenge.',
        chosenBy: 'JudgesPick',
      },
    ],
    note: null,
  },
};

type Row = [minutes: number, title: string, detail?: string];

function template(
  id: string,
  name: string,
  description: string,
  hidden: HubSectionKind[],
  subtitle: string,
  agenda: Row[],
  giving: string | null,
  hackathon = false,
): MockHubTemplate {
  const content: Partial<Record<HubSectionKind, Record<string, unknown>>> = {
    ...(hackathon ? HACKATHON : {}),
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
    sections: (hackathon ? ALL : CORE).map((kind) => ({
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
      true,
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
