import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import {
  CardComponent,
  ListComponent,
  ListItemComponent,
  StackComponent,
} from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/** The Process display (L2-177 AC2): the process’s own name as the heading, its introduction, and a card per stage. */
@Component({
  selector: 'ft-hub-process',
  imports: [CardComponent, ListComponent, ListItemComponent, StackComponent],
  templateUrl: './hub-process.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubProcessComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-process-${++next}`;
  protected readonly content = computed(() => sectionContent(this.hub(), 'Process'));
}
