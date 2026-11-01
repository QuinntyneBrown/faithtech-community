import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HubUpcomingEventDto } from '@faithtech-community/api';
import {
  CardComponent,
  EventCardComponent,
  ListComponent,
  formatDayRange,
  formatMonth,
  formatTime,
} from '@faithtech-community/components';

let next = 0;

/** An upcoming event as an event card shows it: "Sat 21 Nov · 9:00 am · St Lawrence Hall". */
function card(event: HubUpcomingEventDto) {
  const start = new Date(event.startsAt);
  const oneDay = start.toDateString() === new Date(event.endsAt).toDateString();
  const place = event.format === 'Online' ? 'Online' : (event.venue ?? 'In person');
  return {
    id: event.id,
    title: event.title,
    href: `/public/events/${event.id}`,
    month: formatMonth(start),
    day: String(start.getDate()),
    meta: [formatDayRange(event.startsAt, event.endsAt), oneDay ? formatTime(start) : null, place]
      .filter((part): part is string => !!part)
      .join(' · '),
  };
}

/**
 * The Upcoming events display (L2-162 AC2): the next public events the hub reads live, as event cards linking to their
 * public pages, or a note that they will appear. The wizard shows it under its own heading, with `heading` off.
 */
@Component({
  selector: 'ft-hub-upcoming',
  imports: [CardComponent, EventCardComponent, ListComponent],
  templateUrl: './hub-upcoming.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubUpcomingComponent {
  readonly events = input.required<readonly HubUpcomingEventDto[]>();
  /** The list's accessible name. */
  readonly label = input('Upcoming events');
  readonly heading = input(true);

  protected readonly id = `hub-upcoming-${++next}`;
  protected readonly cards = computed(() => this.events().map(card));
}
