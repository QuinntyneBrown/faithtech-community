import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EVENT_HUBS_SERVICE, EventHubDto } from '@faithtech-community/api';
import { CardComponent, LinkComponent, StackComponent } from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/** The Parking display (L2-173 AC3): the note, then each option with its map, linked full size through the hub. */
@Component({
  selector: 'ft-hub-parking',
  imports: [CardComponent, LinkComponent, StackComponent],
  templateUrl: './hub-parking.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubParkingComponent {
  readonly hub = input.required<EventHubDto>();
  private readonly hubs = inject(EVENT_HUBS_SERVICE);

  protected readonly id = `hub-parking-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'Parking'));

  protected map(resourceId: string, thumbnail = false): string {
    return this.hubs.fileUrl(this.hub().eventId, resourceId, thumbnail);
  }
}
