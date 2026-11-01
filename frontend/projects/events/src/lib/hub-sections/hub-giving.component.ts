import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EventHubDto } from '@faithtech-community/api';
import {
  ButtonComponent,
  CardComponent,
  ClusterComponent,
  IconComponent,
  StackComponent,
} from '@faithtech-community/components';

import { sectionContent } from './section-saver';

let next = 0;

/**
 * The Giving display (L2-158 AC3): the event line from the wizard, and the giving text and Give link from Organisation
 * settings, read live.
 */
@Component({
  selector: 'ft-hub-giving',
  imports: [ButtonComponent, CardComponent, ClusterComponent, IconComponent, StackComponent],
  templateUrl: './hub-giving.component.html',
  styleUrl: './hub-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubGivingComponent {
  readonly hub = input.required<EventHubDto>();

  protected readonly id = `hub-giving-${++next}`;
  protected readonly line = computed(() => sectionContent(this.hub(), 'Giving')?.line);
}
