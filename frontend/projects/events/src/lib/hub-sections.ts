import { HubSectionKind } from '@faithtech-community/api';

/**
 * Each hub section kind in its order, with the title, the one line saying what visitors will see (plain language,
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
