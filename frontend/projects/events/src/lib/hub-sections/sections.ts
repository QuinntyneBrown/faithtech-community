import { HubSectionKind } from '@faithtech-community/api';

/**
 * Each hub section kind in catalogue order (L2-172 AC1), with the title, the one line saying what visitors will see (plain language,
 * proposal design rule 6) and, for a section that can need info, the line saying what is missing (L2-156 AC2), as
 * docs/mocks/dialogs/create-event-hub/sections and pages/event-hub show them.
 */
export const HUB_SECTIONS: readonly {
  kind: HubSectionKind;
  title: string;
  line: string;
  missing?: string;
}[] = [
  {
    kind: 'Hero',
    title: 'Hero',
    line: 'The event’s name, date, place and RSVP button at the top.',
  },
  {
    kind: 'Agenda',
    title: 'Agenda',
    line: 'The day’s schedule, with what’s happening now highlighted.',
    missing: 'Add the day’s schedule.',
  },
  {
    kind: 'Venue',
    title: 'Venue',
    line: 'Where it is, with a map link and directions.',
    missing: 'Add a venue to the event.',
  },
  {
    kind: 'Parking',
    title: 'Parking',
    line: 'Where to park, with a map and notes for each option.',
    missing: 'Add a parking option.',
  },
  {
    kind: 'WhatToBring',
    title: 'What to bring',
    line: 'What to bring, and what to expect on the day.',
    missing: 'Add something to bring.',
  },
  {
    kind: 'Partners',
    title: 'Partners',
    line: 'The partners you’re building with, from Partners.',
    missing: 'Pick a partner.',
  },
  {
    kind: 'Tracks',
    title: 'Tracks',
    line: 'The challenges teams choose from, with one marked primary.',
    missing: 'Add a track.',
  },
  {
    kind: 'Process',
    title: 'Process',
    line: 'How teams work through the day, stage by stage.',
    missing: 'Add a stage.',
  },
  {
    kind: 'Rules',
    title: 'Rules',
    line: 'The rules every team builds by.',
    missing: 'Add a rule.',
  },
  {
    kind: 'People',
    title: 'People',
    line: 'Mentors, judges and speakers, with their photos.',
    missing: 'Add mentors, judges or speakers.',
  },
  {
    kind: 'Links',
    title: 'Submission and feedback',
    line: 'Links to the submission and feedback forms.',
    missing: 'Add a submission or feedback link.',
  },
  {
    kind: 'DemoFormat',
    title: 'Demo format',
    line: 'How long each demo runs and what it covers.',
    missing: 'Add the demo’s segments.',
  },
  {
    kind: 'Judging',
    title: 'Judging and honors',
    line: 'How judges score, and the honors teams can win.',
    missing: 'Add a criterion or an honor.',
  },
  {
    kind: 'Worship',
    title: 'Worship',
    line: 'The songs you’ll sing, with links to listen ahead.',
    missing: 'Add a song.',
  },
  {
    kind: 'Slides',
    title: 'Slides',
    line: 'The day’s slides, one after another.',
    missing: 'Add slides.',
  },
  {
    kind: 'Giving',
    title: 'Giving',
    line: 'How to give, from your organisation’s giving link.',
    missing: 'Add your organisation’s giving link in Organisation settings.',
  },
  {
    kind: 'UpcomingEvents',
    title: 'Upcoming events',
    line: 'Your chapter’s next public events, added automatically.',
  },
];

export function hubSection(kind: HubSectionKind) {
  return HUB_SECTIONS.find((s) => s.kind === kind) ?? { kind, title: kind, line: '' };
}
