import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  StackComponent,
  formatTimeRange,
} from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/**
 * The Hero display (L2-158 AC2, docs/design-system/patterns/event-hub-sections.html): the organisation's name, the
 * event's title, the subtitle when there is one, the date and time, the place and an RSVP link, all but the subtitle
 * read live from the event.
 */
@Component({
  selector: 'ft-hub-hero',
  imports: [ButtonComponent, CardComponent, ClusterComponent, StackComponent],
  templateUrl: './hub-hero.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubHeroComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-hero-${++next}`;
  protected readonly subtitle = computed(() => sectionContent(this.hub(), 'Hero')?.subtitle);
  protected readonly when = computed(() =>
    formatTimeRange(this.hub().event.startsAt, this.hub().event.endsAt),
  );
  protected readonly place = computed(() => hubPlace(this.hub()));
}

/** The event's venue, or "Online". */
export function hubPlace(hub: EventHubDto): string {
  return hub.event.format === 'Online' ? 'Online' : (hub.event.venue ?? '');
}
