import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import {
  CardComponent,
  DescriptionListComponent,
  DescriptionListItemComponent,
  IconComponent,
  LinkComponent,
  StackComponent,
} from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/** "Open in maps" for a venue: a search the visitor's maps app can open. */
export function mapsLink(venue: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

/**
 * The Venue display (L2-160 AC2): the event's venue, an "Open in maps" link built from it, and the directions from the
 * wizard.
 */
@Component({
  selector: 'ft-hub-venue',
  imports: [
    CardComponent,
    DescriptionListComponent,
    DescriptionListItemComponent,
    IconComponent,
    LinkComponent,
    StackComponent,
  ],
  templateUrl: './hub-venue.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubVenueComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-venue-${++next}`;
  protected readonly venue = computed(() => this.hub().event.venue ?? '');
  protected readonly maps = computed(() => mapsLink(this.venue()));
  protected readonly directions = computed(() => sectionContent(this.hub(), 'Venue')?.directions);
}
