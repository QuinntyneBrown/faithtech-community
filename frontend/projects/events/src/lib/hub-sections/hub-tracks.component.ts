import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import {
  CardComponent,
  LinkComponent,
  ListComponent,
  ListItemComponent,
  StackComponent,
} from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/** The Tracks display (L2-176 AC2): a card per track, the primary focus marked, then what good looks like. */
@Component({
  selector: 'ft-hub-tracks',
  imports: [CardComponent, LinkComponent, ListComponent, ListItemComponent, StackComponent],
  templateUrl: './hub-tracks.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubTracksComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-tracks-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'Tracks'));
}
