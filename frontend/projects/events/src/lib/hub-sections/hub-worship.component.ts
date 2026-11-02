import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import { LinkComponent, ListComponent, ListItemComponent } from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/** The Worship display (L2-181 AC2): the note, then each song with its artist and a link to listen ahead. */
@Component({
  selector: 'ft-hub-worship',
  imports: [LinkComponent, ListComponent, ListItemComponent],
  templateUrl: './hub-worship.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubWorshipComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-worship-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'Worship'));
}
